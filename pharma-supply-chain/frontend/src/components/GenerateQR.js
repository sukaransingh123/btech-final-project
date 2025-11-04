import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { ethers } from 'ethers';
import ipfs from '../utils/ipfs';

const GenerateQR = ({ contract, account }) => {
  const [userBatches, setUserBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [childQRs, setChildQRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (contract) {
      loadUserBatches();
    }
  }, [contract]);

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
          const userBatches = response.batches
            .filter(b => b.currentOwner?.toLowerCase() === account?.toLowerCase() && !b.parentBatchId)
            .map(b => ({
              tokenId: b.tokenId,
              batchID: b.batchID,
              metadataURI: b.metadataURI
            }));
          setUserBatches(userBatches);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Fallback to blockchain
      }

      // OPTIMIZED: Parallel blockchain queries
      const tokenCounter = Number(await contract.tokenCounter());
      // Scan all tokens (up to 200) to find all batches owned by manufacturer
      const maxToScan = Math.min(tokenCounter - 1, 200);
      
      if (maxToScan <= 0) {
        setUserBatches([]);
        setLoading(false);
        return;
      }

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
              return {
                tokenId,
                batchID: batchDetails.batchID,
                metadataURI: batchDetails.metadataURI
              };
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
      setUserBatches(batches.sort((a, b) => b.tokenId - a.tokenId));
    } catch (error) {
      console.error('Error loading user batches:', error);
      setMessage('Error loading batches');
    } finally {
      setLoading(false);
    }
  };

  const downloadChildQR = (index) => {
    const canvas = document.getElementById(`qr-code-child-${index}`);
    if (canvas) {
      const link = document.createElement('a');
      link.download = `child-qr-${index}.png`;
      link.href = canvas.toDataURL();
      link.click();
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
      
      // Resolve base URL for mobile scanning (prefer HTTPS via env)
      const baseUrl = (process.env.REACT_APP_PUBLIC_BASE_URL && process.env.REACT_APP_PUBLIC_BASE_URL.startsWith('http'))
        ? process.env.REACT_APP_PUBLIC_BASE_URL
        : window.location.origin;

      // Create Parent QR payload
      const payload = {
        type: 'parent',
        batchId: batchDetails.batchID,
        tokenId: selectedBatch,
        contract: contractAddress,
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
      const childPayloads = children.map((cid) => {
        const cPayload = {
          type: 'child',
          parentId: selectedBatch,
          childId: Number(cid),
          contract: contractAddr,
          verifyUrl: `${baseUrl}/verify/${Number(cid)}`,
          timestamp: Date.now(),
          manufacturer: batchDetails.manufacturer,
          parentTimestamp: Number(batchDetails.timestamp)
        };
        // Enrich with metadata fields for child QR
        if (metaJson) {
          cPayload.drugName = metaJson?.attributes?.find?.(a => a.trait_type === 'Drug Name')?.value || '';
          cPayload.mfgDate = metaJson?.attributes?.find?.(a => a.trait_type === 'Manufacturing Date')?.value || '';
          cPayload.expiryDate = metaJson?.attributes?.find?.(a => a.trait_type === 'Expiry Date')?.value || '';
        }
        return cPayload;
      });

      // Sign child payloads sequentially (to avoid nonce conflicts) but batch the rest
      for (const cPayload of childPayloads) {
        try {
          const cHash = ethers.id(JSON.stringify(cPayload));
          const cSig = await signer.signMessage(ethers.getBytes(cHash));
          const childQR = { data: cPayload, signature: cSig, signer: account };
          
          // Try IPFS upload (non-blocking)
          const ipfsPromise = ipfs.uploadMetadata(childQR).catch(() => null);
          const cEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(childQR))));
          const cScanUrl = `${baseUrl}/verify?data=${cEncoded}`;
          
          const ipfsResult = await ipfsPromise;
          childList.push({ 
            ...childQR, 
            ipfsUrl: ipfsResult?.url || null, 
            scanUrl: cScanUrl 
          });
        } catch (err) {
          console.error('Error generating child QR:', err);
          // Continue with other children
        }
      }
      
      setChildQRs(childList);
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

    const canvas = document.getElementById('qr-code');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `pharma-batch-${qrData.data.batchId}.png`;
      link.href = canvas.toDataURL();
      link.click();
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
                onChange={(e) => setSelectedBatch(Number(e.target.value))}
                disabled={loading}
                className="form-input"
              >
                <option value="">Choose a batch...</option>
                {userBatches.map((batch) => (
                  <option key={batch.tokenId} value={batch.tokenId}>
                    {batch.batchID} (Token #{batch.tokenId})
                  </option>
                ))}
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
                  <div className="bg-white p-4 rounded-xl shadow-lg">
                    <QRCode
                      id="qr-code"
                      value={qrData.scanUrl || JSON.stringify(qrData)}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
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
                    {qrData.scanUrl && (
                      <div className="py-2">
                        <span className="text-gray-600 font-medium block mb-1">Scan URL:</span>
                        <a href={qrData.scanUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs break-all">
                          {qrData.scanUrl}
                        </a>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Child QR Codes ({childQRs.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {childQRs.map((cqr, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-shadow">
                      <div className="flex justify-center mb-3">
                        <div className="bg-white p-2 rounded-lg">
                          <QRCode
                            id={`qr-code-child-${idx}`}
                            value={cqr.scanUrl || JSON.stringify(cqr)}
                            size={150}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                      </div>
                      <div className="text-xs space-y-1 mb-3">
                        <div><strong>Child ID:</strong> {cqr.data.childId}</div>
                        <div><strong>Parent:</strong> {cqr.data.parentId}</div>
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
