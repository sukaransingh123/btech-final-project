import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import QRScanner from './QRScanner';
import apiService from '../utils/api';

const VerifyBatch = ({ contract, account }) => {
  const { tokenId } = useParams();
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

  useEffect(() => {
    if (tokenId && contract) {
      loadBatchDetails();
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get('data');
      if (dataParam) {
        const json = decodeURIComponent(escape(atob(dataParam)));
        setQrInput(json);
        setTimeout(() => { verifyQRCode().catch(() => {}); }, 0);
      }
    } catch (_) {}
  }, [tokenId, contract]);

  const loadBatchDetails = async () => {
    try {
      setLoading(true);
      const batchDetails = await contract.getBatchDetails(Number(tokenId));
      const owner = await contract.ownerOf(Number(tokenId));
      const role = await contract.getRole(owner);
      const transferHistory = await contract.getTransferHistory(Number(tokenId));
      
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
    try {
      setQrInput(text);
      await verifyQRCode();
    } catch (_) {}
    setShowScanner(false);
  };

  const verifyQRCode = async () => {
    if (!qrInput.trim()) {
      setMessage('Please enter QR code data');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      setVerificationErrors([]);

      const qrData = JSON.parse(qrInput);
      
      if (!qrData.data || !qrData.signature || !qrData.signer) {
        throw new Error('Invalid QR code format');
      }

      let verificationResult = null;
      let useBlockchainOnly = false;

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
        
        // Use read-only contract for blockchain reads (no MetaMask popup)
        const readContractInstance = readContract || contract;
        const expectedContract = await readContractInstance.getAddress();
        const contractMatch = (qrData.data.contract || '').toLowerCase() === expectedContract.toLowerCase();

        const messageHash = ethers.id(JSON.stringify(qrData.data));
        const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), qrData.signature);

        const onChainBatch = await contract.getBatchDetails(qrData.data.tokenId);
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

      if (!verificationResult || !verificationResult.success) {
        throw new Error(verificationResult?.error || 'Verification failed');
      }

      setIsValid(verificationResult.authentic);
      
      if (verificationResult.authentic) {
        setMessage('Product authenticated successfully');
        
        if (verificationResult.batch && !useBlockchainOnly) {
          setProductInfo({
            drugName: verificationResult.batch.drugName || 'Unknown',
            batchID: verificationResult.batch.batchID,
            manufacturer: verificationResult.batch.manufacturerName || verificationResult.batch.manufacturer,
            expiryDate: verificationResult.batch.expiryDate ? new Date(verificationResult.batch.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase() : 'N/A'
          });
          
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
            const onChainBatch = await contract.getBatchDetails(qrData.data.tokenId);
            const owner = await contract.ownerOf(qrData.data.tokenId);
            const role = await contract.getRole(owner);
            const transferHistory = await contract.getTransferHistory(qrData.data.tokenId);
            
            setVerificationData({
              batchDetails: onChainBatch,
              owner: owner,
              role: Number(role),
              transferHistory: transferHistory || []
            });
          } catch (bcError) {
            console.error('Error fetching blockchain data:', bcError);
          }
        }

        if (contract) {
          try {
            const role = await contract.getRole(account);
            const r = Number(role);
            if (qrData.data.type === 'parent' && (r === 2 || r === 3)) {
              try {
                const tx = await contract.recordScan(qrData.data.tokenId);
                await tx.wait();
              } catch (e) {
                setCounterfeitReason('Repeated scan detected for this role');
              }
            } else if (qrData.data.type === 'child') {
              try {
                const tx2 = await contract.recordChildScan(qrData.data.childId);
                await tx2.wait();
              } catch (_) {}
            }
          } catch (_) {}
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
      }

    } catch (error) {
      console.error('Error verifying QR code:', error);
      setMessage(`Error: ${error.message}`);
      setIsValid(false);
    } finally {
      setLoading(false);
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
                      {productInfo?.drugName || 'Paracetamol 500mg'}
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
                      {productInfo?.manufacturer || verificationData?.batchDetails?.manufacturer?.slice(0, 6) + '...' || 'Unknown Source'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-600 font-medium">Expiry:</span>
                    <span className="font-semibold text-gray-900">
                      {productInfo?.expiryDate || 'EXP N/A'}
                    </span>
                  </div>
                </div>
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
                <h3 className="text-lg font-bold text-gray-800 mb-4">Provenance History</h3>
                <div className="space-y-4">
                  {verificationData.transferHistory.map((record, index) => (
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
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(Number(record.timestamp) * 1000).toLocaleString()}
                        </p>
                        {index === 0 && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            {verificationData.batchDetails?.manufacturer?.slice(0, 10)}... Production Facility
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Scan or Enter QR Code</h2>
          
          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.includes('Error') || message.includes('FAILED') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
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
                onClick={verifyQRCode}
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
                onClick={() => setShowScanner(true)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>Scan QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {showScanner && (
          <QRScanner onDetected={onScanDetected} onClose={() => setShowScanner(false)} />
        )}
      </div>
    </div>
  );
};

export default VerifyBatch;