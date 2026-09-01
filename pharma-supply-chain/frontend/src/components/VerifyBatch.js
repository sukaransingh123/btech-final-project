import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import WebQRScanner from './WebQRScanner';
import apiService from '../utils/api';
import { getParticipantName, getParticipantLocation } from '../utils/participants';
import { CONTRACT_ADDRESS } from '../utils/contract';

const VerifyBatch = ({ contract, readContract, account }) => {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const [verificationData, setVerificationData] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isValid, setIsValid] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [counterfeit, setCounterfeit] = useState(false);
  const [counterfeitReason, setCounterfeitReason] = useState('');
  const [verificationErrors, setVerificationErrors] = useState([]);
  const [productInfo, setProductInfo] = useState(null);
  const [ipfsCid, setIpfsCid] = useState('');
  
  // State for on-chain scan recording
  const [needsOnChainScan, setNeedsOnChainScan] = useState(false);
  const [isRecordingScan, setIsRecordingScan] = useState(false);
  const [scanRecorded, setScanRecorded] = useState(false);
  const [scannedBatchId, setScannedBatchId] = useState(null);

  useEffect(() => {
    if (tokenId && (readContract || contract)) {
      loadBatchDetails();
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get('data');
      if (dataParam) {
        const json = decodeURIComponent(escape(atob(dataParam)));
        setQrInput(json);
        // Fixed: pass json directly instead of reading stale state
        setTimeout(() => { verifyQRCode(json).catch(() => {}); }, 100);
      }
    } catch (_) {}
  }, [tokenId, readContract, contract]);

  const loadBatchDetails = async () => {
    try {
      setLoading(true);
      // Use readContract (works without MetaMask)
      const contractInstance = readContract || contract;
      if (!contractInstance) {
        setMessage('Blockchain connection required');
        return;
      }
      const batchDetails = await contractInstance.getBatchDetails(Number(tokenId));
      const owner = await contractInstance.ownerOf(Number(tokenId));
      const role = await contractInstance.getRole(owner);
      const transferHistory = await contractInstance.getTransferHistory(Number(tokenId));
      
      setVerificationData({
        batchDetails,
        owner,
        role: Number(role),
        transferHistory
      });
    } catch (error) {
      console.error('Error loading batch details:', error);
      setMessage('Error loading batch details');
    } finally {
      setLoading(false);
    }
  };

  const onScanDetected = async (text) => {
    console.log('onScanDetected called with text:', text);
    setShowScanner(false);
    try {
      if (!text || text.trim() === '') {
        setMessage('Error: Empty QR code data received');
        return;
      }
      setQrInput(text);
      // Fixed: pass text directly to avoid stale qrInput closure
      setTimeout(async () => {
        await verifyQRCode(text);
      }, 100);
    } catch (error) {
      setMessage(`Error processing QR code: ${error.message}`);
    }
  };

  // Fixed: accepts optional text param to avoid stale state race condition
  const verifyQRCode = async (inputText) => {
    const dataToVerify = inputText || qrInput;
    
    if (!dataToVerify || !dataToVerify.trim()) {
      setMessage('Please enter QR code data');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      setVerificationErrors([]);

      console.log('Parsing QR input as JSON...');
      let qrData;
      try {
        qrData = JSON.parse(dataToVerify);
        console.log('QR data parsed successfully:', qrData);
      } catch (parseError) {
        console.error('Failed to parse QR input as JSON:', parseError);
        console.error('QR input was:', qrInput);
        throw new Error(`Invalid QR code format: ${parseError.message}. Please ensure you scanned the correct QR code.`);
      }
      
      // For child QR codes, check if it's readable format (no signature required)
      const isChildReadableFormat = qrData.type === 'pharma-product-info' || 
                                    qrData.data?.type === 'child' ||
                                    (qrData.readableInfo && !qrData.signature);
      
      // For parent QR codes, signature is required
      if (!isChildReadableFormat && (!qrData.data || !qrData.signature || !qrData.signer)) {
        throw new Error('Invalid QR code format');
      }

      let verificationResult = null;
      let useBlockchainOnly = false;

      // Handle child QR codes (readable format - no blockchain needed)
      if (isChildReadableFormat) {
        console.log('Child QR code detected - using readable format');
        const readableData = qrData.readableInfo || qrData.data || qrData;
        verificationResult = {
          success: true,
          authentic: true,
          message: '✅ Product information verified',
          isChildQR: true
        };
        
        // Extract product info directly from QR
        if (readableData.product) {
          setProductInfo({
            drugName: readableData.product.drugName || 'Unknown',
            batchID: readableData.product.batchID || 'N/A',
            manufacturer: readableData.product.manufacturer?.name || 'Unknown',
            expiryDate: readableData.product.expiryDate || 'N/A',
            mfgDate: readableData.product.manufacturingDate || 'N/A',
            manufacturerLocation: readableData.product.manufacturer?.location || null
          });
        }
        
        if (readableData.supplyChain) {
          setVerificationData({
            transferHistory: readableData.supplyChain
          });
        }
      } else {
        // Parent QR code - requires blockchain verification
        try {
          setMessage('Verifying product authenticity...');
          verificationResult = await apiService.verifyProduct(
            qrInput,
            qrData.data.tokenId,
            qrData.data.batchId
          );
          
          // Extract errors from verification
          if (verificationResult.verification?.errors) {
            setVerificationErrors(verificationResult.verification.errors);
          }
        } catch (mongoError) {
          console.log('MongoDB verification unavailable, using blockchain-only:', mongoError.message);
          useBlockchainOnly = true;
          setMessage('Verifying on blockchain...');
          
          // Use read-only contract (works without MetaMask)
          const readContractInstance = readContract || contract;
          if (!readContractInstance) {
            throw new Error('Blockchain connection required for parent QR verification. Please connect MetaMask or try again.');
          }
          
          let expectedContract;
          try {
            expectedContract = await readContractInstance.getAddress();
          } catch (_) {
            // Fallback: get contract address from contract instance
            expectedContract = contract?.target || contract?.address || CONTRACT_ADDRESS;
          }
          const contractMatch = (qrData.data.contract || '').toLowerCase() === expectedContract.toLowerCase();

          const messageHash = ethers.id(JSON.stringify(qrData.data));
          const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), qrData.signature);

          const onChainBatch = await readContractInstance.getBatchDetails(qrData.data.tokenId);
          const tokenMatch = Number(qrData.data.tokenId) === Number(onChainBatch.tokenId);
          const onChainValid = onChainBatch.batchID === qrData.data.batchId;
          const manufacturerMatch = recoveredAddress.toLowerCase() === onChainBatch.manufacturer.toLowerCase();

          const overallValid = contractMatch && tokenMatch && manufacturerMatch && onChainValid;
          
          verificationResult = {
            success: true,
            authentic: overallValid,
            message: overallValid ? '✅ Product is AUTHENTIC' : '❌ Product verification FAILED'
          };
        }
      }

      if (!verificationResult || !verificationResult.success) {
        throw new Error(verificationResult?.error || 'Verification failed');
      }

      // Extract product info from QR data if available (for child QR codes)
      if (qrData.data.type === 'child') {
        setProductInfo({
          drugName: qrData.data.drugName || 'Unknown',
          batchID: qrData.data.batchId || qrData.data.batchID || 'N/A',
          manufacturer: qrData.data.manufacturerName || qrData.data.manufacturer || 'Unknown',
          expiryDate: qrData.data.expiryDate || 'N/A',
          mfgDate: qrData.data.mfgDate || 'N/A',
          manufacturerLocation: qrData.data.manufacturerLocation || null
        });
        
        // If transfer history is in QR data, use it
        if (qrData.data.transferHistory && qrData.data.transferHistory.length > 0) {
          setVerificationData(prev => ({
            ...prev,
            transferHistory: qrData.data.transferHistory
          }));
        }
      }
      
          // READ-ONLY scan check: verify role is correct but do NOT write to blockchain.
          // Writing recordScan() during verification caused legitimate batches to be
          // flagged as counterfeit when the wrong role happened to verify them.
          let scanCheckPassed = true;
          let scanError = null;
          if (qrData.data?.type === 'parent') {
            try {
              // Check if batch is already marked counterfeit on-chain (read-only)
              try {
                const contractToUse = contract || readContract;
                if (contractToUse) {
                  const isCounterfeitOnChain = await contractToUse.isCounterfeit(qrData.data.tokenId);
                  if (isCounterfeitOnChain) {
                    scanCheckPassed = false;
                    scanError = { type: 'counterfeit', message: 'Batch already flagged as counterfeit on blockchain' };
                  }
                }
              } catch (_) {}

              // If connected with a wallet, also check that the user role is correct (read-only)
              if (contract && account && scanCheckPassed) {
                try {
                  const userRole = await contract.getRole(account);
                  const r = Number(userRole);
                  const batchDetails = await contract.getBatchDetails(qrData.data.tokenId);
                  const batchCurrentRole = Number(batchDetails.currentRole);

                  // Only Distributor (2) and Retailer (3) need to record scans on-chain to unlock their transfer ability.
                  // Pharmacy (4) is the end of the line, so they only verify locally.
                  if ((r === 2 || r === 3) && batchCurrentRole) {
                    if (r === batchCurrentRole) {
                      // Correct role is scanning! Check if they already recorded their scan on-chain
                      try {
                        const alreadyScanned = await contract.scannedByRole(qrData.data.tokenId, r);
                        if (!alreadyScanned) {
                          setNeedsOnChainScan(true);
                          setScannedBatchId(qrData.data.tokenId);
                        } else {
                          setScanRecorded(true);
                        }
                      } catch (_) {}
                    } else {
                      // Role mismatch: show warning but don't flag counterfeit
                      console.warn(`Role mismatch during verify: scanner role ${r}, batch role ${batchCurrentRole}`);
                    }
                  }
                } catch (_) {}
              }
            } catch (err) {
              console.error('Error in scan check:', err);
            }
          }
      
      // Set validation result based on both signature verification AND scan check
      const isAuthentic = verificationResult.authentic && scanCheckPassed;
      setIsValid(isAuthentic);
      
      // Handle scan errors FIRST - this takes priority
      if (!scanCheckPassed && scanError) {
        setCounterfeit(true);
        setCounterfeitReason(scanError.message);
        setIsValid(false);
        if (scanError.type === 'repeated_scan') {
          setMessage('❌ Counterfeit detected: Batch already scanned by this role. Repeated scans are not allowed.');
        } else if (scanError.type === 'wrong_role') {
          setMessage('❌ Counterfeit detected: Wrong role scanned this batch');
        } else if (scanError.type === 'counterfeit') {
          setMessage('❌ Counterfeit detected: Batch has been flagged as counterfeit');
        }
        return; // Stop here - don't show success message
      }
      
      // Only show success if BOTH signature AND scan check passed
      if (verificationResult.authentic && scanCheckPassed) {
        setMessage('Product authenticated successfully');
        
        if (verificationResult.batch && !useBlockchainOnly) {
          setProductInfo(prev => ({
            ...prev,
            drugName: verificationResult.batch.drugName || prev?.drugName || 'Unknown',
            batchID: verificationResult.batch.batchID || prev?.batchID,
            manufacturer: verificationResult.batch.manufacturerName || verificationResult.batch.manufacturer || prev?.manufacturer,
            expiryDate: verificationResult.batch.expiryDate ? new Date(verificationResult.batch.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase() : prev?.expiryDate || 'N/A'
          }));
          
          setVerificationData({
            batchDetails: {
              batchID: verificationResult.batch.batchID,
              tokenId: verificationResult.batch.tokenId,
              timestamp: new Date(verificationResult.batch.createdAt).getTime() / 1000,
              manufacturer: verificationResult.batch.manufacturer
            },
            owner: verificationResult.batch.currentOwner,
            role: verificationResult.batch.currentRole === 'Manufacturer' ? 1 :
                  verificationResult.batch.currentRole === 'Distributor' ? 2 :
                  verificationResult.batch.currentRole === 'Retailer' ? 3 : 4,
            transferHistory: verificationResult.batch.history || []
          });
        } else {
          try {
            // Use readContract (works without MetaMask)
            const contractInstance = readContract || contract;
            if (contractInstance && qrData.data?.tokenId) {
              const onChainBatch = await contractInstance.getBatchDetails(qrData.data.tokenId);
              const owner = await contractInstance.ownerOf(qrData.data.tokenId);
              const role = await contractInstance.getRole(owner);
              const transferHistory = await contractInstance.getTransferHistory(qrData.data.tokenId);
              
              setVerificationData({
                batchDetails: onChainBatch,
                owner: owner,
                role: Number(role),
                transferHistory: transferHistory || []
              });
            }
          } catch (bcError) {
            console.error('Error fetching blockchain data:', bcError);
            // Non-critical - continue with QR data only
          }
        }

        // Handle child QR scans (non-blocking) - only if MetaMask is connected
        if (contract && account && qrData.data?.type === 'child') {
          try {
            const tx2 = await contract.recordChildScan(qrData.data.childId);
            await tx2.wait();
            setMessage('✅ Child scan recorded successfully');
          } catch (_) {
            // Non-critical for child scans
          }
        }

        if (verificationResult.batch?.isCounterfeit || 
            verificationResult.verification?.checks?.counterfeitFlag === false) {
          setCounterfeit(true);
          if (!counterfeitReason) {
            setCounterfeitReason('Batch flagged counterfeit');
          }
          setMessage('Batch flagged as counterfeit');
          setIsValid(false);
        }
      } else {
        setMessage('Product verification failed');
        if (verificationResult.verification?.checks?.counterfeitFlag === false) {
          setCounterfeit(true);
          setCounterfeitReason(verificationResult.verification.errors?.join(', ') || 'Verification failed');
        }
        setIsValid(false);
      }
    } catch (error) {
      console.error('QR verification error:', error);
      setMessage(`❌ Verification failed: ${error.message || 'Invalid QR code'}`);
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordScan = async () => {
    if (!contract || !scannedBatchId) return;
    try {
      setIsRecordingScan(true);
      const tx = await contract.recordScan(scannedBatchId);
      setMessage('Recording scan on blockchain...');
      await tx.wait();
      setScanRecorded(true);
      setNeedsOnChainScan(false);
      setMessage('✅ Product authenticated AND scan recorded on blockchain. Ready for transfer!');
    } catch (err) {
      console.error('Error recording scan:', err);
      setMessage(`❌ Failed to record scan: ${err.shortMessage || err.reason || err.message}`);
    } finally {
      setIsRecordingScan(false);
    }
  };

  const getRoleName = (role) => {
    switch (role) {
      case 1: return 'Manufacturer';
      case 2: return 'Distributor';
      case 3: return 'Retailer';
      case 4: return 'Pharmacy';
      default: return 'Unknown';
    }
  };

  if (loading && !verificationData && isValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-700">PharmaTrust Authentication</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-8">
        {/* Verification Result Card - Mobile First */}
        {isValid !== null && (
          <div className={`mb-6 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${
            isValid && !counterfeit 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200' 
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200'
          }`}>
            {/* Status Badge */}
            <div className={`p-6 text-center ${
              isValid && !counterfeit ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <div className="flex items-center justify-center gap-3 mb-2">
                {isValid && !counterfeit ? (
                  <>
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-2xl font-bold text-green-700">Verified Authentic</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-2xl font-bold text-red-700">Potential Counterfeit</span>
                  </>
                )}
              </div>
              <p className={`text-sm font-medium ${
                isValid && !counterfeit ? 'text-green-600' : 'text-red-600'
              }`}>
                {isValid && !counterfeit 
                  ? 'This product has been authenticated.' 
                  : 'This product could not be authenticated.'}
              </p>
            </div>

            {/* Product Details */}
            {(productInfo || verificationData) && (
              <div className="p-6 bg-white/80">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Product:</span>
                    <span className={`px-4 py-1 rounded-full text-sm font-semibold ${
                      isValid && !counterfeit 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-pink-100 text-pink-800'
                    }`}>
                      {productInfo?.drugName || 'Unknown Product (Not in DB)'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Batch:</span>
                    <span className="font-semibold text-gray-900">
                      {(productInfo || verificationData)?.batchDetails?.batchID || verificationData?.batchDetails?.batchID || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Manufacturer:</span>
                    <span className="font-semibold text-gray-900">
                      {productInfo?.manufacturer || getParticipantName(verificationData?.batchDetails?.manufacturer) || 'Unknown Source'}
                    </span>
                  </div>
                  
                  {productInfo?.manufacturerLocation && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Manufacturer Location:</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {productInfo.manufacturerLocation}
                      </span>
                    </div>
                  )}
                  
                  {productInfo?.mfgDate && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600 font-medium">Manufacturing Date:</span>
                      <span className="font-semibold text-gray-900">
                        {productInfo.mfgDate}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600 font-medium">Expiry:</span>
                    <span className="font-semibold text-gray-900">
                      {productInfo?.expiryDate || 'EXP N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* IPFS View Section */}
            <div className="p-6 bg-blue-50 border-t border-blue-200">
              <h3 className="text-lg font-bold text-blue-800 mb-4">View IPFS Data</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={ipfsCid}
                  onChange={(e) => setIpfsCid(e.target.value)}
                  placeholder="Paste JSON CID here (e.g., QmXxxx...)"
                  className="flex-1 px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    if (ipfsCid.trim()) {
                      navigate(`/ipfs?cid=${encodeURIComponent(ipfsCid.trim())}`);
                    }
                  }}
                  disabled={!ipfsCid.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open IPFS View
                </button>
              </div>
              <p className="text-sm text-blue-700 mt-2">
                Paste the CID of your JSON file uploaded to IPFS Desktop to view batch details.
              </p>
            </div>

            {/* Blockchain Record Scan Action */}
            {isValid && !counterfeit && needsOnChainScan && !scanRecorded && (
              <div className="p-6 bg-yellow-50 border-t border-yellow-200">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-bold text-yellow-800">Action Required: Record Scan</h3>
                </div>
                <p className="text-sm text-yellow-700 mb-4">
                  You have successfully authenticated this batch. To legally transfer it to the next stakeholder, you must record this scan on the blockchain.
                </p>
                <button
                  onClick={handleRecordScan}
                  disabled={isRecordingScan}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRecordingScan ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Recording to Blockchain...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Record Scan on Blockchain
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Scan Recorded Confirmation */}
            {isValid && !counterfeit && scanRecorded && (
              <div className="p-6 bg-green-50 border-t border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-bold text-green-800">Scan Recorded</h3>
                </div>
                <p className="text-sm text-green-700">
                  Your scan is permanently recorded on the blockchain. This batch is ready for transfer.
                </p>
              </div>
            )}

            {/* Security Alert for Counterfeit */}
            {(!isValid || counterfeit) && verificationErrors.length > 0 && (
              <div className="p-6 bg-orange-50 border-t-2 border-orange-200">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="text-lg font-bold text-orange-800">Security Alert</h3>
                </div>
                <ul className="space-y-2 text-sm text-orange-700">
                  {verificationErrors.map((error, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-1">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Provenance History for Authentic */}
            {isValid && !counterfeit && verificationData?.transferHistory && verificationData.transferHistory.length > 0 && (
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Supply Chain History</h3>
                <div className="space-y-4">
                  {verificationData.transferHistory.map((record, index) => {
                    const fromName = record.fromName || getParticipantName(record.from);
                    const toName = record.toName || getParticipantName(record.to);
                    const fromLocation = record.fromLocation || getParticipantLocation(record.from);
                    const toLocation = record.toLocation || getParticipantLocation(record.to);
                    return (
                      <div key={index} className="flex items-start gap-3 pl-4 border-l-2 border-blue-400">
                        <div className={`mt-1 p-2 rounded-full ${
                          index === 0 ? 'bg-blue-100' : 'bg-gray-200'
                        }`}>
                          {index === 0 ? (
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {getRoleName(Number(record.fromRole))} → {getRoleName(Number(record.toRole))}
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            <span className="font-medium">{fromName}</span>
                            {fromLocation && <span className="text-gray-500"> • {fromLocation}</span>}
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            <span className="font-medium">→ {toName}</span>
                            {toLocation && <span className="text-gray-500"> • {toLocation}</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(Number(record.timestamp) * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Show manufacturer info at the start */}
                  <div className="flex items-start gap-3 pl-4 border-l-2 border-green-400 bg-green-50 p-3 rounded-lg">
                    <div className="mt-1 p-2 rounded-full bg-green-100">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Manufactured By</p>
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">{getParticipantName(verificationData.batchDetails?.manufacturer)}</span>
                        <span className="text-gray-500"> • {getParticipantLocation(verificationData.batchDetails?.manufacturer)}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(Number(verificationData.batchDetails?.timestamp || 0) * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Scan or Enter QR Code</h2>
          
          {message && (
            <div className={`mb-4 p-4 rounded-lg shadow-sm border ${
              message.includes('Error') || message.includes('FAILED') || message.includes('❌') || message.includes('Counterfeit') || message.includes('counterfeit') || message.toLowerCase().includes('revert') || message.toLowerCase().includes('failed')
                ? 'bg-red-50 text-red-800 border-red-300' 
                : 'bg-blue-50 text-blue-800 border-blue-300'
            } break-words overflow-hidden whitespace-pre-wrap`}>
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code Data
              </label>
              <textarea
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste QR code data here or scan with camera..."
                rows="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => verifyQRCode()}
                disabled={loading || !qrInput.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Verify Product</span>
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  // Check if camera is supported before opening scanner
                  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    if (!navigator.getUserMedia) {
                      setMessage('Camera access not available in MetaMask browser. Please use Paste mode to enter QR code data manually.');
                      return;
                    }
                  }
                  setShowScanner(true);
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>Scan QR Code</span>
              </button>
              <div className="mt-2 text-xs text-gray-500 text-center">
                Note: MetaMask browser may not support camera. Use Paste mode if scanning doesn't work.
              </div>
            </div>
          </div>
        </div>

        {showScanner && (
          <WebQRScanner onDetected={onScanDetected} onClose={() => setShowScanner(false)} />
        )}
      </div>
    </div>
  );
};

export default VerifyBatch;