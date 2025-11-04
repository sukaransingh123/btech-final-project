import React, { useState } from 'react';
import { ethers } from 'ethers';
import { PARTICIPANTS } from '../utils/participants';
import { useNavigate } from 'react-router-dom';
import apiService from '../utils/api';

const CreateBatch = ({ contract, account }) => {
  const [formData, setFormData] = useState({
    batchID: '',
    drugName: '',
    mfgDate: '',
    expiryDate: '',
    quantity: '',
    qaCertificate: null
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({
      ...prev,
      qaCertificate: e.target.files[0]
    }));
  };

  const uploadToIPFS = async (file) => {
    // In a real application, you would upload to IPFS here
    // For now, we'll simulate with a mock IPFS hash
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`QmMockIPFSHash${Date.now()}`);
      }, 1000);
    });
  };

  const createMetadata = () => {
    return {
      name: `Pharma Batch: ${formData.batchID}`,
      description: `Pharmaceutical batch ${formData.batchID}`,
      image: "https://via.placeholder.com/300x300?text=Pharma+Batch",
      attributes: [
        {
          trait_type: "Drug Name",
          value: formData.drugName
        },
        {
          trait_type: "Manufacturing Date",
          value: formData.mfgDate
        },
        {
          trait_type: "Expiry Date",
          value: formData.expiryDate
        },
        {
          trait_type: "Quantity",
          value: formData.quantity
        },
        {
          trait_type: "Batch ID",
          value: formData.batchID
        }
      ]
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!contract) {
      setMessage('Contract not connected');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      // Preflight: ensure Polygon Amoy and manufacturer role
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== 80002) {
        setMessage('Please switch MetaMask to Polygon Amoy (chainId 80002) and try again.');
        setLoading(false);
        return;
      }

      try {
        const signer = await provider.getSigner();
        const signerAddr = (await signer.getAddress()).toLowerCase();
        const requiredMfg = (PARTICIPANTS?.MANUFACTURER || '').toLowerCase();
        if (requiredMfg && signerAddr !== requiredMfg) {
          setMessage(`Wrong account connected. Connect Manufacturer ${PARTICIPANTS.MANUFACTURER}`);
          setLoading(false);
          return;
        }
        const isMfg = await contract.isManufacturer(signerAddr);
        if (!isMfg) {
          setMessage('Your wallet is not registered as Manufacturer on this deployment. Ask owner to register.');
          setLoading(false);
          return;
        }
      } catch (_) {}

      // OPTIONAL: Create batch in MongoDB FIRST (if backend is available)
      // This stores rich metadata and files, blockchain remains source of truth
      let mongoRef = null;
      let metadataHash = null;
      
      try {
        setMessage('Storing batch metadata in database (optional)...');
        const contractAddress = await contract.getAddress();
        
        const batchData = {
          batchID: formData.batchID,
          drugName: formData.drugName,
          manufacturingDate: formData.mfgDate,
          expiryDate: formData.expiryDate,
          quantity: parseInt(formData.quantity) || 1,
          manufacturer: account.toLowerCase(),
          contractAddress: contractAddress
        };

        const mongoResponse = await apiService.createBatch(
          batchData,
          formData.qaCertificate
        );

        if (mongoResponse.success) {
          mongoRef = mongoResponse.batch.mongoRef;
          metadataHash = mongoResponse.batch.metadataHash;
          setMessage('Metadata stored. Minting NFT on blockchain...');
        }
      } catch (mongoError) {
        // MongoDB is optional - continue with blockchain-only flow
        console.log('MongoDB not available, continuing with blockchain-only:', mongoError.message);
        setMessage('MongoDB unavailable, using blockchain-only mode. Minting NFT...');
        
        // Generate metadata hash manually for blockchain (using browser crypto API)
        const metadataString = JSON.stringify({
          batchID: formData.batchID,
          drugName: formData.drugName,
          manufacturingDate: formData.mfgDate,
          expiryDate: formData.expiryDate,
          quantity: parseInt(formData.quantity) || 1,
          manufacturer: account.toLowerCase()
        });
        
        // Use Web Crypto API for browser
        const encoder = new TextEncoder();
        const data = encoder.encode(metadataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        metadataHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Step 2: Create metadata for NFT (blockchain operation)
      const metadata = createMetadata();
      const metadataJSON = JSON.stringify(metadata);
      const tokenURI = mongoRef 
        ? `https://api.pharmatracker.com/metadata/${mongoRef}`
        : `data:application/json,${encodeURIComponent(metadataJSON)}`;

      // Estimate gas and check balance (prefer populateTransaction, fallback to manual encoding)
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      // Minimal balance check (0.05 MATIC)
      try {
        const bal = await provider.getBalance(addr);
        if (bal < ethers.parseEther('0.02')) {
          setMessage('Insufficient MATIC on Polygon Amoy (need ~0.02+). Please top-up from faucet and retry.');
          setLoading(false);
          return;
        }
      } catch (_) {}
      let estGas = null;
      try {
        if (contract.populateTransaction && contract.populateTransaction.mintBatch) {
          const txReq = await contract.populateTransaction.mintBatch(tokenURI, formData.batchID);
          estGas = await signer.estimateGas({ ...txReq, from: addr });
        } else {
          // Fallback: encode function data and estimate via provider
          if (contract.interface && contract.interface.getFunction && contract.interface.getFunction('mintBatch')) {
            const data = contract.interface.encodeFunctionData('mintBatch', [tokenURI, formData.batchID, metadataHash]);
            const to = await contract.getAddress();
            estGas = await provider.estimateGas({ from: addr, to, data });
          } else {
            // As a last resort, skip estimation and let the node/MetaMask estimate
            estGas = null;
          }
        }
      } catch (err) {
        // Best-effort: continue without local estimate
        estGas = null;
      }

      // Static call to catch potential reverts with a readable reason
      try {
        if (contract.mintBatch && contract.mintBatch.staticCall) {
          await contract.mintBatch.staticCall(tokenURI, formData.batchID, metadataHash);
        }
      } catch (simErr) {
        const reason = (simErr?.shortMessage || simErr?.info?.error?.message || simErr?.message || '').toLowerCase();
        const isGenericProviderIssue = reason.includes('missing revert data') || reason.includes('call exception') || reason.includes('internal json-rpc error');
        const isAuthOrInvalid = reason.includes('unauthorized') || reason.includes('only') || reason.includes('invalid');
        if (!isGenericProviderIssue || isAuthOrInvalid) {
          setMessage(`Transaction would revert: ${simErr?.shortMessage || simErr?.info?.error?.message || simErr?.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }
        // Otherwise continue; let the node estimate/send the tx
      }

      // Mint the parent NFT with retry strategy
      let tx;
      try {
        const overrides = {};
        if (estGas) overrides.gasLimit = estGas + (estGas / 5n);
        tx = await contract.mintBatch(tokenURI, formData.batchID, overrides);
        await tx.wait();
      } catch (sendErr) {
        // Retry with legacy gas price if provider hiccups (-32603)
        try {
          const gp = await provider.send('eth_gasPrice', []);
          const legacyOverrides = { gasPrice: gp ? ethers.toBigInt(gp) : undefined };
          tx = await contract.mintBatch(tokenURI, formData.batchID, metadataHash, legacyOverrides);
          await tx.wait();
        } catch (sendErr2) {
          throw sendErr2;
        }
      }

      // Determine newly minted parent tokenId (tokenCounter incremented post-mint)
      const current = await contract.tokenCounter();
      const parentId = Number(current) - 1;

      // Step 3: Update MongoDB with tokenId (if MongoDB was used)
      // Try using batchID instead of mongoRef for update
      if (mongoRef || formData.batchID) {
        try {
          setMessage('Synchronizing with database...');
          // Use batchID for update (more reliable than mongoRef)
          await apiService.updateBatch(formData.batchID, {
            tokenId: parentId,
            metadataURI: tokenURI
          });
        } catch (updateError) {
          // Non-critical - blockchain event listener will sync it automatically
          console.log('MongoDB update skipped (event listener will auto-sync):', updateError.message);
        }
      }

      // Mint child batches equal to quantity (if > 0)
      // Note: Child batches inherit parent's metadataHash from contract
      const qty = parseInt(formData.quantity || '0', 10);
      if (qty > 0) {
        setMessage('Creating child batches...');
        try {
          const txChild = await contract.mintChildBatches(parentId, qty, tokenURI);
          await txChild.wait();
        } catch (childErr) {
          try {
            const gp2 = await provider.send('eth_gasPrice', []);
            const legacyOverrides2 = { gasPrice: gp2 ? ethers.toBigInt(gp2) : undefined };
            const txChild2 = await contract.mintChildBatches(parentId, qty, tokenURI, legacyOverrides2);
            await txChild2.wait();
          } catch (childErr2) {
            throw childErr2;
          }
        }
      }

      setMessage('✅ Batch created successfully! NFT minted on blockchain. MongoDB will sync automatically via event listener.');
      
      // Reset form
      setFormData({
        batchID: '',
        drugName: '',
        mfgDate: '',
        expiryDate: '',
        quantity: '',
        qaCertificate: null
      });

      // Navigate to dashboard after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('Error creating batch:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-100 rounded-xl">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Batch</h1>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="batchID" className="block text-sm font-semibold text-gray-700 mb-2">
                Batch ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="batchID"
                name="batchID"
                value={formData.batchID}
                onChange={handleInputChange}
                required
                placeholder="e.g., BATCH2024001"
                className="form-input"
              />
            </div>

            <div>
              <label htmlFor="drugName" className="block text-sm font-semibold text-gray-700 mb-2">
                Drug Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="drugName"
                name="drugName"
                value={formData.drugName}
                onChange={handleInputChange}
                required
                placeholder="e.g., Paracetamol 500mg"
                className="form-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="mfgDate" className="block text-sm font-semibold text-gray-700 mb-2">
                  Manufacturing Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="mfgDate"
                  name="mfgDate"
                  value={formData.mfgDate}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                />
              </div>

              <div>
                <label htmlFor="expiryDate" className="block text-sm font-semibold text-gray-700 mb-2">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="expiryDate"
                  name="expiryDate"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                required
                placeholder="e.g., 1000"
                className="form-input"
              />
              <p className="text-xs text-gray-500 mt-1">Number of child batches to create</p>
            </div>

            <div>
              <label htmlFor="qaCertificate" className="block text-sm font-semibold text-gray-700 mb-2">
                QA Certificate <span className="text-gray-400">(Optional)</span>
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors">
                <div className="space-y-1 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="qaCertificate" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        id="qaCertificate"
                        name="qaCertificate"
                        onChange={handleFileChange}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF, JPG, PNG up to 10MB</p>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating Batch...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Batch
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateBatch;
