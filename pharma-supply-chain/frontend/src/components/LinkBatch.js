import React, { useState, useEffect } from 'react';

const LinkBatch = ({ contract, account }) => {
  const [userBatches, setUserBatches] = useState([]);
  const [parentBatch, setParentBatch] = useState(null);
  const [childBatch, setChildBatch] = useState(null);
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
      
      for (let i = 1; i < Number(tokenCounter); i++) {
        try {
          const owner = await contract.ownerOf(i);
          if (owner.toLowerCase() === account.toLowerCase()) {
            const batchDetails = await contract.getBatchDetails(i);
            
            // Only show batches from the same manufacturer
            if (batchDetails.manufacturer.toLowerCase() === account.toLowerCase()) {
              batches.push({
                tokenId: i,
                batchID: batchDetails.batchID,
                metadataURI: batchDetails.metadataURI
              });
            }
          }
        } catch (error) {
          // Token doesn't exist
        }
      }
      
      setUserBatches(batches);
    } catch (error) {
      console.error('Error loading user batches:', error);
      setMessage('Error loading batches');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkBatches = async () => {
    if (!parentBatch || !childBatch) {
      setMessage('Please select both parent and child batches');
      return;
    }

    if (parentBatch === childBatch) {
      setMessage('Parent and child batches cannot be the same');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      // Check if child batch is already linked to a parent
      const existingParent = await contract.getParentBatch(childBatch);
      if (Number(existingParent) !== 0) {
        throw new Error('Child batch is already linked to another parent');
      }

      // Show transaction preview
      const parentBatchID = userBatches.find(b => b.tokenId === parentBatch)?.batchID;
      const childBatchID = userBatches.find(b => b.tokenId === childBatch)?.batchID;
      const confirmed = window.confirm(
        `Link Batches\n\n` +
        `Parent: ${parentBatchID} (Token #${parentBatch})\n` +
        `Child: ${childBatchID} (Token #${childBatch})\n\n` +
        `This will create a parent-child relationship.\n` +
        `Estimated gas: ~0.005 MATIC\n\n` +
        `MetaMask will ask you to confirm the transaction.\n` +
        `Continue?`
      );
      
      if (!confirmed) {
        setLoading(false);
        return;
      }

      setMessage('Please confirm the transaction in MetaMask to link the batches...');

      // Link the batches
      const tx = await contract.linkChildBatch(parentBatch, childBatch);
      setMessage('Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      setMessage('Batches linked successfully!');
      
      // Reset form
      setParentBatch(null);
      setChildBatch(null);

    } catch (error) {
      console.error('Error linking batches:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadChildBatches = async (parentId) => {
    try {
      const childBatches = await contract.getChildBatches(parentId);
      return childBatches.map(id => Number(id));
    } catch (error) {
      console.error('Error loading child batches:', error);
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Link Batches</h1>
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
              <label htmlFor="parentBatch" className="block text-sm font-semibold text-gray-700 mb-2">
                Parent Batch
              </label>
              <select
                id="parentBatch"
                value={parentBatch || ''}
                onChange={(e) => setParentBatch(Number(e.target.value))}
                disabled={loading}
                className="form-input"
              >
                <option value="">Choose parent batch...</option>
                {userBatches.map((batch) => (
                  <option key={batch.tokenId} value={batch.tokenId}>
                    {batch.batchID} (Token #{batch.tokenId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="childBatch" className="block text-sm font-semibold text-gray-700 mb-2">
                Child Batch
              </label>
              <select
                id="childBatch"
                value={childBatch || ''}
                onChange={(e) => setChildBatch(Number(e.target.value))}
                disabled={loading}
                className="form-input"
              >
                <option value="">Choose child batch...</option>
                {userBatches
                  .filter(batch => batch.tokenId !== parentBatch)
                  .map((batch) => (
                    <option key={batch.tokenId} value={batch.tokenId}>
                      {batch.batchID} (Token #{batch.tokenId})
                    </option>
                  ))}
              </select>
            </div>

            {userBatches.length === 0 && !loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-700">No batches found. Create batches first to link them.</p>
              </div>
            )}

            <button 
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              onClick={handleLinkBatches}
              disabled={!parentBatch || !childBatch || loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Linking...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Link Batches
                </span>
              )}
            </button>

            {(parentBatch || childBatch) && (
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                {parentBatch && (
                  <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Parent Batch
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Batch ID:</span>
                        <span className="font-semibold text-gray-900">{userBatches.find(b => b.tokenId === parentBatch)?.batchID}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Token ID:</span>
                        <span className="font-semibold text-gray-900">{parentBatch}</span>
                      </div>
                    </div>
                  </div>
                )}

                {childBatch && (
                  <div className="bg-purple-50 rounded-xl p-6 border-2 border-purple-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Child Batch
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Batch ID:</span>
                        <span className="font-semibold text-gray-900">{userBatches.find(b => b.tokenId === childBatch)?.batchID}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Token ID:</span>
                        <span className="font-semibold text-gray-900">{childBatch}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Batch Linking Rules
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>Only manufacturers can link batches</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>Both batches must be owned by the same manufacturer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>A child batch can only be linked to one parent</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>Parent-child relationships help track sub-batches and lot numbers</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkBatch;
