import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../utils/api';

const GenerateIPFSJson = ({ contract, account }) => {
  const [formData, setFormData] = useState({
    batchID: '',
    drugName: '',
    manufacturer: '',
    manufacturerLocation: '',
    mfgDate: '',
    expiryDate: '',
    quantity: '',
    certificateCID: '',
    certificates: ''
  });
  const [existingBatches, setExistingBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Load existing batches if contract is available
  useEffect(() => {
    if (contract && account) {
      loadExistingBatches();
    }
  }, [contract, account]);

  const loadExistingBatches = async () => {
    try {
      setLoading(true);
      // Try to get batches from API first
      try {
        const response = await apiService.getAllBatches({ owner: account });
        if (response.success && response.batches) {
          setExistingBatches(response.batches);
          return;
        }
      } catch (e) {
        console.log('API not available, trying blockchain...');
      }

      // Fallback to blockchain
      if (contract) {
        const tokenCounter = Number(await contract.tokenCounter());
        const batches = [];
        for (let i = 1; i < Math.min(tokenCounter, 50); i++) {
          try {
            const owner = await contract.ownerOf(i);
            if (owner.toLowerCase() === account.toLowerCase()) {
              const batchDetails = await contract.getBatchDetails(i);
              batches.push({
                tokenId: i,
                batchID: batchDetails.batchID,
                drugName: batchDetails.drugName || 'Unknown',
                mfgDate: new Date(Number(batchDetails.timestamp) * 1000).toISOString().split('T')[0],
                expiryDate: batchDetails.expiryDate || '',
                quantity: batchDetails.quantity || 1
              });
            }
          } catch (e) {
            // Token doesn't exist
          }
        }
        setExistingBatches(batches);
      }
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const loadBatchData = (batch) => {
    setSelectedBatch(batch);
    setFormData({
      batchID: batch.batchID || '',
      drugName: batch.drugName || '',
      manufacturer: account || '',
      manufacturerLocation: '',
      mfgDate: batch.mfgDate || batch.manufacturingDate || '',
      expiryDate: batch.expiryDate || '',
      quantity: batch.quantity || '',
      certificateCID: '',
      certificates: ''
    });
  };

  const generateJSON = () => {
    const jsonData = {
      batchID: formData.batchID,
      drugName: formData.drugName,
      manufacturer: formData.manufacturer,
      ...(formData.manufacturerLocation && { manufacturerLocation: formData.manufacturerLocation }),
      mfgDate: formData.mfgDate,
      expiryDate: formData.expiryDate,
      quantity: parseInt(formData.quantity) || 0,
      ...(formData.certificateCID && { certificateCID: formData.certificateCID }),
      ...(formData.certificates && {
        certificates: formData.certificates.split(',').map(c => c.trim()).filter(c => c)
      })
    };

    return jsonData;
  };

  const downloadJSON = () => {
    const jsonData = generateJSON();
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-${formData.batchID || 'data'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const previewJSON = () => {
    const jsonData = generateJSON();
    return JSON.stringify(jsonData, null, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate IPFS JSON File</h1>
          <p className="text-gray-600">
            Create a JSON file with your batch data to upload to IPFS Desktop. 
            You can either enter data manually or load from an existing batch.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Batch Information</h2>

            {/* Load from existing batch */}
            {existingBatches.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Load from Existing Batch (Optional)
                </label>
                <select
                  onChange={(e) => {
                    const batch = existingBatches.find(b => b.tokenId === parseInt(e.target.value));
                    if (batch) loadBatchData(batch);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a batch...</option>
                  {existingBatches.map(batch => (
                    <option key={batch.tokenId} value={batch.tokenId}>
                      {batch.batchID} - {batch.drugName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Batch ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="batchID"
                  value={formData.batchID}
                  onChange={handleInputChange}
                  placeholder="e.g., BATCH-2024-001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Drug Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="drugName"
                  value={formData.drugName}
                  onChange={handleInputChange}
                  placeholder="e.g., Paracetamol 500mg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Manufacturer Address
                </label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleInputChange}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Manufacturer Location
                </label>
                <input
                  type="text"
                  name="manufacturerLocation"
                  value={formData.manufacturerLocation}
                  onChange={handleInputChange}
                  placeholder="e.g., Mumbai, India"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Manufacturing Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="mfgDate"
                    value={formData.mfgDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  placeholder="e.g., 10000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Certificate CID (Single)
                </label>
                <input
                  type="text"
                  name="certificateCID"
                  value={formData.certificateCID}
                  onChange={handleInputChange}
                  placeholder="QmXxxx... (from IPFS Desktop)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the CID of your certificate uploaded to IPFS Desktop
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Certificate CIDs (Multiple, comma-separated)
                </label>
                <input
                  type="text"
                  name="certificates"
                  value={formData.certificates}
                  onChange={handleInputChange}
                  placeholder="QmXxxx..., QmYyyy... (comma-separated)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Multiple certificate CIDs separated by commas
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={downloadJSON}
                disabled={!formData.batchID || !formData.drugName}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download JSON
              </button>
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">JSON Preview</h2>
            <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[600px]">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                {previewJSON()}
              </pre>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Next Steps:</strong>
              </p>
              <ol className="text-sm text-blue-700 mt-2 list-decimal list-inside space-y-1">
                <li>Click "Download JSON" to save the file</li>
                <li>Open IPFS Desktop</li>
                <li>Drag and drop the downloaded JSON file</li>
                <li>Copy the CID that IPFS Desktop gives you</li>
                <li>Use that CID in your app (QR generator or viewer)</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateIPFSJson;

