import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { PARTICIPANTS } from '../utils/participants';
import apiService from '../utils/api';

const TransferBatch = ({ contract, account }) => {
  const [userBatches, setUserBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  // Address will be derived from selected role
  const [recipientRoleSelect, setRecipientRoleSelect] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentRoleNum, setCurrentRoleNum] = useState(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [isCounterfeit, setIsCounterfeit] = useState(false);

  // (moved below loadUserBatches)

  // Load current role and scan/counterfeit flags when selection changes
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        if (!contract || !selectedBatch) return;
        // Determine current role from on-chain batch details
        const bd = await contract.getBatchDetails(selectedBatch);
        const role = Number(bd.currentRole);
        setCurrentRoleNum(role);
        // Check scan status for this role (public mapping)
        try {
          const scanned = await contract.scannedByRole(selectedBatch, role);
          setHasScanned(Boolean(scanned));
        } catch (_) { setHasScanned(false); }
        // Check counterfeit flag
        try {
          const cf = await contract.isCounterfeit(selectedBatch);
          setIsCounterfeit(Boolean(cf));
        } catch (_) { setIsCounterfeit(false); }
      } catch (_) {
        setHasScanned(false);
        setIsCounterfeit(false);
      }
    };
    fetchFlags();
  }, [contract, selectedBatch]);

  const loadUserBatches = useCallback(async () => {
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
              currentRole: b.currentRole === 'Manufacturer' ? 1 : b.currentRole === 'Distributor' ? 2 : b.currentRole === 'Retailer' ? 3 : 4,
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
      // Scan all tokens (up to 200) to find all batches owned by user
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
                currentRole: Number(batchDetails.currentRole),
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
      
      // Sort by tokenId descending (newest first)
      setUserBatches(batches.sort((a, b) => b.tokenId - a.tokenId));
    } catch (error) {
      console.error('Error loading user batches:', error);
      setMessage('Error loading batches');
    } finally {
      setLoading(false);
    }
  }, [contract, account]);

  // Load user batches when contract changes
  useEffect(() => {
    if (contract) {
      loadUserBatches();
    }
  }, [contract, loadUserBatches]);

  const handleTransfer = async () => {
    if (!selectedBatch) {
      setMessage('Please select a parent batch');
      return;
    }
    if (!recipientRoleSelect) {
      setMessage('Please select the recipient role');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      // Map role to known participant address
      const recipientAddress = recipientRoleSelect === 'Distributor'
        ? PARTICIPANTS.DISTRIBUTOR
        : recipientRoleSelect === 'Retailer'
          ? PARTICIPANTS.RETAILER
          : recipientRoleSelect === 'Manufacturer'
            ? PARTICIPANTS.MANUFACTURER
            : '';
      if (!recipientAddress) throw new Error('Unknown recipient role');

      // Verify sender owns the selected parent
      const owner = await contract.ownerOf(selectedBatch);
      if (owner.toLowerCase() !== account.toLowerCase()) {
        throw new Error('You are not the current owner of this parent batch');
      }

      // Check if recipient has a role assigned
      const recipientRole = await contract.getRole(recipientAddress);
      const recipientRoleNum = Number(recipientRole);
      if (recipientRoleNum === 0) {
        throw new Error('Recipient does not have a role assigned');
      }

      // Get current batch details
      const batchDetails = await contract.getBatchDetails(selectedBatch);
      const currentRole = Number(batchDetails.currentRole);
      const nextRole = recipientRoleNum;

      // Validate selected role matches recipient actual role
      const selectedRoleNum = recipientRoleSelect === 'Distributor' ? 2
        : recipientRoleSelect === 'Retailer' ? 3
        : recipientRoleSelect === 'Pharmacy' ? 4
        : recipientRoleSelect === 'Manufacturer' ? 1
        : 0;
      if (selectedRoleNum === 0 || selectedRoleNum !== nextRole) {
        throw new Error('Selected recipient role does not match the recipient address role');
      }

      // Validate transfer sequence per new rules
      const validTransfer = (
        (currentRole === 1 && (nextRole === 2 || nextRole === 3)) || // Manufacturer → Distributor or Retailer
        (currentRole === 2 && nextRole === 3) || // Distributor → Retailer
        (currentRole === 3 && nextRole === 4)    // Retailer → Pharmacy
      );

      if (!validTransfer) {
        throw new Error('Invalid transfer sequence. Check role requirements.');
      }

      // Block if counterfeit or not scanned (UI guard; contract also enforces)
      if (isCounterfeit) throw new Error('This batch is flagged counterfeit. Transfer is blocked.');
      // Manufacturer does not need to scan; others must
      if (currentRoleNum === 1 ? false : !hasScanned) {
        throw new Error('Scan required before transfer. Open Verify and scan the QR first.');
      }

      // Preflight: static call to surface revert reasons before prompting MetaMask
      try {
        if (contract.transferParentAndChildren && contract.transferParentAndChildren.staticCall) {
          await contract.transferParentAndChildren.staticCall(selectedBatch, recipientAddress);
        } else if (contract.transferBatch && contract.transferBatch.staticCall) {
          await contract.transferBatch.staticCall(selectedBatch, recipientAddress);
        }
      } catch (simErr) {
        const reason = (simErr?.shortMessage || simErr?.info?.error?.message || simErr?.message || '').toLowerCase();
        const isGenericProviderIssue = reason.includes('missing revert data') || reason.includes('call exception') || reason.includes('internal json-rpc error');
        const isAuthOrInvalid = reason.includes('unauthorized') || reason.includes('only') || reason.includes('invalid') || reason.includes('counterfeit') || reason.includes('scan required') || reason.includes('invalid transfer');
        if (!isGenericProviderIssue || isAuthOrInvalid) {
          throw new Error(`Transaction would revert: ${simErr?.shortMessage || simErr?.info?.error?.message || simErr?.message || 'Unknown error'}`);
        }
        // Otherwise continue; let the node estimate/send the tx
      }

      // Minimal balance check (~0.02 MATIC)
      try {
        const provider = contract.runner?.provider;
        const signerAddr = account;
        if (provider && signerAddr) {
          const bal = await provider.getBalance(signerAddr);
          if (bal < 20000000000000000n) { // 0.02
            throw new Error('Insufficient MATIC on Polygon Amoy (need ~0.02+). Please top-up and retry.');
          }
        }
      } catch (bErr) {
        if (bErr?.message?.includes('Insufficient MATIC')) throw bErr;
      }

      // Execute bulk transfer with retry strategy (legacy gasPrice)
      const provider = contract.runner?.provider;
      const sendWithRetry = async (fn, args) => {
        try {
          const tx = await fn(...args);
          const txHash = tx.hash; // Capture hash before waiting
          await tx.wait();
          return txHash; // Return the hash
        } catch (sendErr) {
          if (!provider) throw sendErr;
          try {
            let legacyOverrides;
            try {
              const gp = await provider.send('eth_gasPrice', []);
              legacyOverrides = { gasPrice: gp ? ethers.toBigInt(gp) : undefined };
            } catch (gpErr) {
              // If rate limited (-32005), fallback to a conservative static gas price
              const msg = (gpErr?.message || '').toLowerCase();
              if (msg.includes('rate limited') || msg.includes('-32005')) {
                legacyOverrides = { gasPrice: ethers.parseUnits('30', 'gwei') };
              } else {
                // Unknown failure fetching gas price: try without overrides
                legacyOverrides = undefined;
              }
            }
            const tx2 = legacyOverrides ? await fn(...[...args, legacyOverrides]) : await fn(...args);
            const txHash2 = tx2.hash; // Capture hash before waiting
            await tx2.wait();
            return txHash2; // Return the hash
          } catch (sendErr2) {
            throw sendErr2;
          }
        }
      };

      let txHash;
      if (contract.transferParentAndChildren) {
        txHash = await sendWithRetry(contract.transferParentAndChildren, [selectedBatch, recipientAddress]);
      } else {
        txHash = await sendWithRetry(contract.transferBatch, [selectedBatch, recipientAddress]);
        try {
          const children = await contract.getChildBatches(selectedBatch);
          for (let i = 0; i < Number(children.length); i++) {
            const childId = Number(children[i]);
            await sendWithRetry(contract.transferBatch, [childId, recipientAddress]);
          }
        } catch (_) {}
      }

      // OPTIONAL: Sync transfer with MongoDB (blockchain event listener will also catch this)
      try {
        await apiService.recordTransfer(selectedBatch, {
          from: account.toLowerCase(),
          to: recipientAddress.toLowerCase(),
          fromRole: currentRole === 1 ? 'Manufacturer' : currentRole === 2 ? 'Distributor' : currentRole === 3 ? 'Retailer' : 'Pharmacy',
          toRole: recipientRoleSelect,
          txHash: txHash
        });
        setMessage('✅ Batch transferred successfully! (MongoDB synced)');
      } catch (dbError) {
        // MongoDB is optional - blockchain event listener will auto-sync
        setMessage('✅ Batch transferred successfully on blockchain!');
        console.log('MongoDB sync skipped (event listener will auto-sync):', dbError.message);
      }
      
      // Reset form
      setSelectedBatch(null);
      
      // Reload batches
      await loadUserBatches();

    } catch (error) {
      console.error('Error transferring batch:', error);
      setMessage(`Error: ${error.message}`);
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

  const getNextRoles = (currentRole) => {
    switch (currentRole) {
      case 1: return ['Distributor', 'Retailer'];
      case 2: return ['Retailer'];
      case 3: return ['Pharmacy'];
      default: return [];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-green-100 rounded-xl">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Transfer Batch</h1>
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
                Select Batch to Transfer
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
                    {batch.batchID} (Token #{batch.tokenId}) - Current: {getRoleName(batch.currentRole)}
                  </option>
                ))}
              </select>
            </div>

            {userBatches.length === 0 && !loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-700">No batches found that you can transfer.</p>
              </div>
            )}

            {selectedBatch && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-blue-900">Batch Status</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Scan Status:</span>
                    <span className={hasScanned ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {hasScanned ? '✅ Scanned' : '❌ Not Scanned'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Counterfeit Flag:</span>
                    <span className={isCounterfeit ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                      {isCounterfeit ? '⚠️ Flagged' : '✅ Clear'}
                    </span>
                  </div>
                  {currentRoleNum === 1 && (
                    <div className="text-xs text-blue-700 mt-2">
                      ⓘ Manufacturers can transfer without scanning
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="recipientRole" className="block text-sm font-semibold text-gray-700 mb-2">
                Recipient Role
              </label>
              <select
                id="recipientRole"
                value={recipientRoleSelect}
                onChange={(e) => setRecipientRoleSelect(e.target.value)}
                disabled={loading || !selectedBatch}
                className="form-input"
              >
                <option value="">Choose role...</option>
                {selectedBatch && getNextRoles(userBatches.find(b => b.tokenId === selectedBatch)?.currentRole).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {currentRoleNum !== 1 && !hasScanned && !isCounterfeit && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-semibold text-yellow-900">Scan Required</span>
                </div>
                <p className="text-sm text-yellow-700 mb-3">You must scan this batch before transferring.</p>
                <a 
                  className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                  href={`/verify/${selectedBatch}`} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  Open Verify to Scan
                </a>
              </div>
            )}

            <button 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              onClick={handleTransfer}
              disabled={!selectedBatch || !recipientRoleSelect || loading || (currentRoleNum !== 1 && !hasScanned) || isCounterfeit}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Transferring...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Transfer Batch
                </span>
              )}
            </button>
          </div>

          {/* Transfer Rules */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Transfer Rules
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span><strong className="text-blue-800">Manufacturer</strong> can transfer to <strong className="text-blue-800">Distributor</strong> or <strong className="text-blue-800">Retailer</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span><strong className="text-blue-800">Distributor</strong> can only transfer to <strong className="text-blue-800">Retailer</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span><strong className="text-blue-800">Retailer</strong> can only transfer to <strong className="text-blue-800">Pharmacy</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Recipient must have the appropriate role assigned</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Only the current owner can transfer the batch</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferBatch;
