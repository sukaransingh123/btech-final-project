import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { ethers } from 'ethers';
import ipfs from '../utils/ipfs';
import { CONTRACT_ADDRESS, ROLE_NAMES } from '../utils/contract';
import { getParticipantInfo } from '../utils/participants';
import apiService from '../utils/api';
import { getBaseUrl } from '../utils/networkUtils';

const getRoleName = (role) => {
  return ROLE_NAMES[role] || 'Unknown';
};

const GenerateQR = ({ contract, account }) => {
  const [userBatches, setUserBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [childQRs, setChildQRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (contract && account) {
      loadUserBatches();
    }
  }, [contract, account]);

  const loadUserBatches = async () => {
    try {
      setLoading(true);
      
      // Try MongoDB API first for faster loading
      try {
        const apiService = (await import('../utils/api')).default;
        const response = await Promise.race([
          apiService.getAllBatches({ owner: account }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        if (response.success && response.batches) {
          console.log('MongoDB response batches:', response.batches);
          console.log('Account:', account);
          console.log('Total batches from API:', response.batches.length);
          
          // Match Dashboard logic EXACTLY: filter by owner, then filter out child batches
          // Dashboard doesn't require tokenId - it just filters by owner and !parentBatchId
          const userBatches = response.batches
            .filter(b => {
              if (!b) return false;
              
              const ownerMatch = b.currentOwner?.toLowerCase() === account?.toLowerCase();
              // Check if it's a parent batch (parentBatchId is null, undefined, or 0)
              const isParent = b.parentBatchId == null || b.parentBatchId === 0 || b.parentBatchId === '';
              
              console.log(`Batch ${b.batchID || 'NO-ID'}: ownerMatch=${ownerMatch}, isParent=${isParent}, tokenId=${b.tokenId}, parentBatchId=${b.parentBatchId}, currentOwner=${b.currentOwner}`);
              
              return ownerMatch && isParent;
            })
            .map(b => ({
              tokenId: b.tokenId, // tokenId might be null/undefined, but we'll handle that
              batchID: b.batchID,
              metadataURI: b.metadataURI
            }))
            .filter(b => b.batchID); // Only require batchID, tokenId can be null initially
          
          console.log('Loaded batches from MongoDB for GenerateQR:', userBatches);
          console.log('MongoDB batch count:', userBatches.length);
          console.log('Filtered batches:', userBatches);
          
          // If we have batches but no tokenIds, we need to get them from blockchain
          const batchesWithTokenId = userBatches.filter(b => b.tokenId);
          const batchesWithoutTokenId = userBatches.filter(b => !b.tokenId);
          
          if (batchesWithTokenId.length > 0) {
            setUserBatches(batchesWithTokenId);
            setLoading(false);
            return;
          }
          
          // If no batches have tokenId, fall through to blockchain query
          console.log('No batches with tokenId found, falling back to blockchain');
        }
      } catch (e) {
        console.log('MongoDB API failed or no batches with tokenId, falling back to blockchain:', e.message);
        // Fallback to blockchain
      }

      // OPTIMIZED: Parallel blockchain queries
      const tokenCounter = Number(await contract.tokenCounter());
      // tokenCounter is the next token ID to be minted, so existing tokens are 1 to tokenCounter-1
      // Scan all tokens (up to 200) to find all batches owned by manufacturer
      const maxToScan = Math.min(tokenCounter, 200);
      
      if (maxToScan <= 0) {
        setUserBatches([]);
        setLoading(false);
        return;
      }

      // Token IDs start from 1 (tokenCounter=1 means no tokens yet, tokenCounter=2 means token 1 exists)
      const tokenIds = Array.from({ length: maxToScan }, (_, i) => i + 1);
      const batches = [];
      
      // Process in parallel batches of 10
      const batchSize = 10;
      for (let i = 0; i < tokenIds.length; i += batchSize) {
        const chunk = tokenIds.slice(i, i + batchSize);
        const promises = chunk.map(async (tokenId) => {
          try {
            const [owner, parent, batchDetails] = await Promise.all([
              contract.ownerOf(tokenId).catch(() => null),
              contract.getParentBatch(tokenId).catch(() => 0),
              contract.getBatchDetails(tokenId).catch(() => null)
            ]);
            // Only include parent batches owned by current user
            if (owner && owner.toLowerCase() === account.toLowerCase() && 
                Number(parent) === 0 && batchDetails) {
              console.log(`Blockchain: Found parent batch - Token ${tokenId}, BatchID: ${batchDetails.batchID}`);
              return {
                tokenId,
                batchID: batchDetails.batchID,
                metadataURI: batchDetails.metadataURI
              };
            } else {
              if (owner && owner.toLowerCase() === account.toLowerCase()) {
                console.log(`Blockchain: Skipping batch - Token ${tokenId}, parent=${parent}, hasDetails=${!!batchDetails}`);
              }
            }
          } catch {
            // Token doesn't exist or error
          }
          return null;
        });
        
        const results = await Promise.all(promises);
        batches.push(...results.filter(b => b !== null));
      }
      
      // Sort by tokenId descending (newest first) and set
      const sortedBatches = batches
        .filter(b => b && b.tokenId && b.batchID) // Filter out invalid batches
        .sort((a, b) => b.tokenId - a.tokenId);
      console.log('Loaded batches for GenerateQR:', sortedBatches);
      console.log('Batch count:', sortedBatches.length);
      console.log('Sample batch:', sortedBatches[0]);
      setUserBatches(sortedBatches);
      setLoading(false);
    } catch (error) {
      console.error('Error loading user batches:', error);
      setMessage('Error loading batches');
      setUserBatches([]);
      setLoading(false);
    }
  };

  const downloadChildQR = (index) => {
    const canvas = document.getElementById(`qr-code-child-${index}`);
    if (canvas && canvas.toDataURL) {
      const link = document.createElement('a');
      link.download = `child-qr-${index}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      // Fallback for SVG
      try {
        const svgElement = document.querySelector(`#qr-code-child-${index} svg`);
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const link = document.createElement('a');
            link.download = `child-qr-${index}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
      } catch (err) {
        console.error('Error downloading child QR:', err);
      }
    }
  };

  const generateQR = async () => {
    if (!selectedBatch) {
      setMessage('Please select a batch');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      // Get batch details
      const batchDetails = await contract.getBatchDetails(selectedBatch);
      
      // Resolve base URL for mobile scanning (uses network IP in development)
      const baseUrl = await getBaseUrl();

      // Create Parent QR payload
      const payload = {
        type: 'parent',
        batchId: batchDetails.batchID,
        tokenId: selectedBatch,
        contract: CONTRACT_ADDRESS,
        network: {
          chainId: 80002, // Polygon Amoy
          chainName: 'Polygon Amoy',
          rpcUrl: 'https://polygon-amoy.drpc.org'
        },
        verifyUrl: `${baseUrl}/verify/${selectedBatch}`,
        timestamp: Date.now()
      };

      // Show confirmation dialog before asking for signature
      const confirmed = window.confirm(
        `Generate QR Code for Batch ${batchDetails.batchID}?\n\n` +
        `You'll need to sign a message with MetaMask to authenticate the QR code.\n` +
        `This signature proves you're the authorized manufacturer.`
      );
      
      if (!confirmed) {
        setLoading(false);
        return;
      }

      // Sign the payload with the user's private key
      // NOTE: This requires MetaMask confirmation for security (cannot be avoided)
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      setMessage('Please confirm the signature in MetaMask to generate the QR code...');
      const messageHash = ethers.id(JSON.stringify(payload));
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      // Create final Parent QR data
      const qrPayload = {
        data: payload,
        signature: signature,
        signer: account
      };

      // Optionally upload QR payload to IPFS for reference
      let ipfsRef = null;
      try {
        const upload = await ipfs.uploadMetadata(qrPayload);
        ipfsRef = upload.url;
      } catch (e) {
        // Non-fatal: continue without IPFS URL
      }

      // Build URL with base64-encoded payload for easy scanning on mobile
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(qrPayload))));
      const scanUrl = `${baseUrl}/verify?data=${encoded}`;
      setQrData({ ...qrPayload, ipfsUrl: ipfsRef, scanUrl });

      // Store QR data with signature in MongoDB for verification
      try {
        await apiService.storeQRData(
          selectedBatch, // tokenId
          batchDetails.batchID, // batchID
          qrPayload, // Full QR payload: { data: payload, signature: signature, signer: account }
          signature // Signature string (also included in qrPayload.signature, but passed separately for API)
        );
        console.log('✅ QR data with signature stored in MongoDB successfully');
      } catch (mongoError) {
        console.warn('⚠️ Failed to store QR data in MongoDB (non-critical):', mongoError);
        // Non-critical: QR code still works, just not stored in MongoDB
      }

      // Build Child QRs for all linked child tokens
      const children = await contract.getChildBatches(selectedBatch);
      // Try to enrich payload with metadata JSON (optional)
      let metaJson = null;
      try {
        if (batchDetails.metadataURI) {
          const r = await fetch(batchDetails.metadataURI);
          if (r.ok) metaJson = await r.json();
        }
      } catch (_) {}
      
      // OPTIMIZED: Generate child QR payloads in parallel (but sign sequentially to avoid nonce issues)
      const childList = [];
      
      // Get transfer history for child QR with participant information
      let transferHistory = [];
      try {
        const history = await contract.getTransferHistory(selectedBatch);
        transferHistory = history.map(h => {
          const fromInfo = getParticipantInfo(h.from);
          const toInfo = getParticipantInfo(h.to);
          return {
            from: h.from,
            to: h.to,
            fromRole: Number(h.fromRole),
            toRole: Number(h.toRole),
            timestamp: Number(h.timestamp),
            fromName: fromInfo?.name || h.from?.slice(0, 6) + '...',
            toName: toInfo?.name || h.to?.slice(0, 6) + '...',
            fromLocation: fromInfo?.location ? `${fromInfo.location.city}, ${fromInfo.location.state}` : null,
            toLocation: toInfo?.location ? `${toInfo.location.city}, ${toInfo.location.state}` : null
          };
        });
      } catch (_) {}
      
      // Get manufacturer info
      const manufacturerInfo = getParticipantInfo(batchDetails.manufacturer);
      
      const childPayloads = children.map((cid) => {
        const cPayload = {
          type: 'child',
          parentId: selectedBatch,
          childId: Number(cid),
          contract: CONTRACT_ADDRESS,
          network: {
            chainId: 80002, // Polygon Amoy
            chainName: 'Polygon Amoy',
            rpcUrl: 'https://rpc-amoy.polygon.technology'
          },
          verifyUrl: `${baseUrl}/verify/${Number(cid)}`,
          timestamp: Date.now(),
          manufacturer: batchDetails.manufacturer,
          manufacturerName: manufacturerInfo?.name || 'Unknown Manufacturer',
          manufacturerLocation: manufacturerInfo?.location ? `${manufacturerInfo.location.city}, ${manufacturerInfo.location.state}` : null,
          parentTimestamp: Number(batchDetails.timestamp),
          transferHistory: transferHistory
        };
        // Enrich with metadata fields for child QR
        if (metaJson) {
          cPayload.drugName = metaJson?.attributes?.find?.(a => a.trait_type === 'Drug Name')?.value || '';
          cPayload.mfgDate = metaJson?.attributes?.find?.(a => a.trait_type === 'Manufacturing Date')?.value || '';
          cPayload.expiryDate = metaJson?.attributes?.find?.(a => a.trait_type === 'Expiry Date')?.value || '';
        }
        return cPayload;
      });

      // Generate child QR codes as readable JSON (no website redirect, no MetaMask required)
      for (const cPayload of childPayloads) {
        try {
          // Create human-readable product information for child QR
          const productInfo = {
            type: 'pharma-product-info',
            version: '1.0',
            product: {
              drugName: cPayload.drugName || 'Unknown',
              batchID: batchDetails.batchID,
              manufacturingDate: cPayload.mfgDate || 'N/A',
              expiryDate: cPayload.expiryDate || 'N/A',
              manufacturer: {
                name: cPayload.manufacturerName || 'Unknown Manufacturer',
                location: cPayload.manufacturerLocation || 'Unknown Location',
                address: cPayload.manufacturer
              }
            },
            supplyChain: {
              origin: {
                role: 'Manufacturer',
                name: cPayload.manufacturerName || 'Unknown',
                location: cPayload.manufacturerLocation || null,
                timestamp: new Date(Number(cPayload.parentTimestamp) * 1000).toLocaleString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              },
              journey: (cPayload.transferHistory || []).map((transfer, idx) => ({
                step: idx + 1,
                from: {
                  role: getRoleName(transfer.fromRole),
                  name: transfer.fromName || 'Unknown',
                  location: transfer.fromLocation || null
                },
                to: {
                  role: getRoleName(transfer.toRole),
                  name: transfer.toName || 'Unknown',
                  location: transfer.toLocation || null
                },
                timestamp: new Date(Number(transfer.timestamp) * 1000).toLocaleString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }))
            },
            verification: {
              contract: CONTRACT_ADDRESS,
              network: 'Polygon Amoy',
              tokenId: cPayload.childId,
              parentTokenId: cPayload.parentId
            },
            scannedAt: new Date().toISOString()
          };

          // Create a readable JSON string for QR code (formatted for display)
          const readableJson = JSON.stringify(productInfo, null, 2);
          
          // For QR code, use compact JSON (no spaces) to reduce size but keep readable
          const compactJson = JSON.stringify(productInfo);
          
          childList.push({ 
            data: cPayload, // Keep original data for verification if needed
            readableInfo: productInfo,
            scanUrl: compactJson, // QR code content - compact JSON that can be displayed
            displayFormat: 'json' // Indicates this is display-only, not a URL
          });
        } catch (err) {
          console.error('Error generating child QR:', err);
          // Continue with other children
        }
      }
      
      setChildQRs(childList);
      
      // Note: Child QR codes don't need to be stored in MongoDB as they're display-only JSON
      // They don't require signature verification like parent QR codes
      
      setMessage('QR code generated successfully!');

    } catch (error) {
      console.error('Error generating QR:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrData) return;

    // Try to get canvas element (when renderAs="canvas")
    const canvas = document.getElementById('qr-code');
    if (canvas && canvas.toDataURL) {
      const link = document.createElement('a');
      link.download = `pharma-batch-${qrData.data.batchId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      // Fallback: Create canvas from SVG or use QR code data directly
      try {
        const svgElement = document.querySelector('#qr-code svg');
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const link = document.createElement('a');
            link.download = `pharma-batch-${qrData.data.batchId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            URL.revokeObjectURL(url);
          };
          img.src = url;
        } else {
          // Last resort: download as text/JSON
          const dataStr = JSON.stringify(qrData, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.download = `pharma-batch-${qrData.data.batchId}.json`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error('Error downloading QR:', err);
        setMessage('Error downloading QR code. Please take a screenshot instead.');
      }
    }
  };

  const copyQRData = () => {
    if (!qrData) return;
    
    navigator.clipboard.writeText(JSON.stringify(qrData, null, 2));
    setMessage('QR data copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-100 rounded-xl">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Generate QR Code</h1>
          </div>
          
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.includes('Error') || message.includes('❌')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          {loading && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-blue-700">Loading batches...</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label htmlFor="batchSelect" className="block text-sm font-semibold text-gray-700 mb-2">
                Select Batch
              </label>
              <select
                id="batchSelect"
                value={selectedBatch || ''}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const value = e.target.value;
                  console.log('Dropdown changed:', value, 'Type:', typeof value);
                  const numValue = value ? Number(value) : null;
                  console.log('Setting selectedBatch to:', numValue);
                  setSelectedBatch(numValue);
                  setMessage(''); // Clear any previous messages
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                disabled={loading || userBatches.length === 0}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  backgroundColor: (loading || userBatches.length === 0) ? '#f3f4f6' : '#ffffff',
                  cursor: (loading || userBatches.length === 0) ? 'not-allowed' : 'pointer',
                  pointerEvents: (loading || userBatches.length === 0) ? 'none' : 'auto',
                  zIndex: 10,
                  position: 'relative'
                }}
                className="focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              >
                <option value="">{loading ? 'Loading batches...' : userBatches.length === 0 ? 'No batches available' : 'Choose a batch...'}</option>
                {userBatches.map((batch) => {
                  if (!batch || !batch.tokenId) {
                    console.warn('Invalid batch in userBatches:', batch);
                    return null;
                  }
                  return (
                    <option key={batch.tokenId} value={String(batch.tokenId)}>
                      {batch.batchID || 'Unknown'} (Token #{batch.tokenId})
                    </option>
                  );
                })}
              </select>
            </div>

            {userBatches.length === 0 && !loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-700">No batches found. Create a batch first to generate QR codes.</p>
              </div>
            )}

            <button 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              onClick={generateQR}
              disabled={!selectedBatch || loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Generate QR Code
                </span>
              )}
            </button>

            {qrData && (
              <div className="mt-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Generated QR Code</h2>
                
                <div className="flex justify-center mb-6">
                  <div className="bg-white p-6 rounded-xl shadow-lg">
                    <QRCode
                      id="qr-code"
                      value={qrData.scanUrl || JSON.stringify(qrData)}
                      size={400}
                      level="H"
                      includeMargin={true}
                      renderAs="canvas"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      imageSettings={{
                        src: '',
                        height: 0,
                        width: 0,
                        excavate: false,
                      }}
                    />
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800 mb-2">
                    <strong>📱 Mobile Scanning:</strong> This QR code must be scanned through our website for verification.
                  </p>
                  {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                      <p className="font-semibold text-yellow-900 mb-1">Testing from Phone:</p>
                      <ol className="list-decimal list-inside space-y-1 text-yellow-800">
                        <li>Make sure your phone is on the same WiFi network as your computer</li>
                        <li>Open the QR code on your computer</li>
                        <li>Scan it with your phone's camera (will open in browser)</li>
                        <li>The QR code URL should show your computer's IP address (not localhost)</li>
                      </ol>
                      <p className="mt-2 text-yellow-900 font-semibold">
                        QR URL: {qrData.scanUrl?.split('?')[0] || 'Generating...'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-blue-700">
                      Scan this QR code with your phone's camera to open the verification page.
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">QR Code Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Batch ID:</span>
                      <span className="font-semibold text-gray-900">{qrData.data.batchId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Token ID:</span>
                      <span className="font-semibold text-gray-900">{qrData.data.tokenId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Contract:</span>
                      <span className="font-mono text-xs text-blue-600">{qrData.data.contract?.slice(0, 10)}...</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Signature:</span>
                      <span className="font-mono text-xs text-green-600 flex items-center gap-1">
                        {qrData.signature ? (
                          <>
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Present
                          </>
                        ) : (
                          <span className="text-red-600">Missing</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Signer:</span>
                      <span className="font-mono text-xs text-gray-900">{qrData.signer?.slice(0, 10)}...{qrData.signer?.slice(-8)}</span>
                    </div>
                    {qrData.scanUrl && (
                      <div className="py-2">
                        <span className="text-gray-600 font-medium block mb-1">Scan URL:</span>
                        <a href={qrData.scanUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs break-all">
                          {qrData.scanUrl}
                        </a>
                        <p className="text-xs text-gray-500 mt-1">
                          QR code contains signed payload with signature for verification
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                    onClick={downloadQR}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download QR Code
                  </button>
                  <button 
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                    onClick={copyQRData}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy QR Data
                  </button>
                </div>
              </div>
            )}

            {childQRs.length > 0 && (
              <div className="mt-8 bg-white rounded-2xl p-6 shadow-xl">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Child QR Codes ({childQRs.length})</h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>📱 Mobile-Friendly:</strong> Child QR codes contain product information in JSON format. 
                      When scanned on a phone, the information will be displayed directly without requiring MetaMask or website access.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {childQRs.map((cqr, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
                      <div className="flex justify-center mb-3">
                        <div className="bg-white p-3 rounded-lg">
                          <QRCode
                            id={`qr-code-child-${idx}`}
                            value={cqr.scanUrl || JSON.stringify(cqr.readableInfo || cqr)}
                            size={200}
                            level="H"
                            includeMargin={true}
                            renderAs="canvas"
                            bgColor="#FFFFFF"
                            fgColor="#000000"
                          />
                        </div>
                      </div>
                      <div className="text-xs space-y-1 mb-3">
                        <div><strong>Child ID:</strong> {cqr.data?.childId || cqr.readableInfo?.verification?.tokenId}</div>
                        <div><strong>Parent:</strong> {cqr.data?.parentId || cqr.readableInfo?.verification?.parentTokenId}</div>
                        <div className="text-green-600 font-semibold mt-2">📱 Scannable on Phone (No MetaMask)</div>
                      </div>
                      <button 
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                        onClick={() => downloadChildQR(idx)}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateQR;
