import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ipfsUrl } from '../utils/ipfsGateway';

const IpfsViewPage = () => {
  const [searchParams] = useSearchParams();
  const [jsonData, setJsonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cid = searchParams.get('cid');

  const fetchJsonData = async (cidValue) => {
    try {
      setLoading(true);
      setError('');
      const url = ipfsUrl(cidValue);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setJsonData(data);
    } catch (err) {
      console.error('Error fetching IPFS data:', err);
      setError(`Failed to fetch data from IPFS: ${err.message}`);
      setJsonData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cid) {
      fetchJsonData(cid);
    } else {
      setError('No CID provided in URL. Use /ipfs?cid=<CID>');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const renderValue = (value) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">null</span>;
    }
    if (typeof value === 'object') {
      return (
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-red-600'}>{String(value)}</span>;
    }
    return <span className="text-gray-900">{String(value)}</span>;
  };

  const renderField = (key, value, depth = 0) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={key} className={`${depth > 0 ? 'ml-4 border-l-2 border-gray-200 pl-4' : ''}`}>
          <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4">{key}</h3>
          <div className="space-y-2">
            {Object.entries(value).map(([subKey, subValue]) => 
              renderField(subKey, subValue, depth + 1)
            )}
          </div>
        </div>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} mb-3`}>
          <h4 className="font-medium text-gray-700 mb-1">{key}:</h4>
          <div className="space-y-2">
            {value.map((item, index) => (
              <div key={index} className="bg-gray-50 p-2 rounded">
                {typeof item === 'object' ? (
                  Object.entries(item).map(([subKey, subValue]) => 
                    renderField(subKey, subValue, depth + 1)
                  )
                ) : (
                  renderValue(item)
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Check if this looks like a CID (starts with Qm or bafy, or is a long hash)
    const isPossibleCID = typeof value === 'string' && (
      value.startsWith('Qm') || 
      value.startsWith('bafy') ||
      value.length > 40
    );

    return (
      <div key={key} className={`${depth > 0 ? 'ml-4' : ''} mb-3`}>
        <div className="flex items-start justify-between gap-4">
          <span className="font-medium text-gray-700 min-w-[150px]">{key}:</span>
          <div className="flex-1">
            {isPossibleCID ? (
              <div className="flex flex-col gap-2">
                <a 
                  href={ipfsUrl(value)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {value}
                </a>
                <a
                  href={ipfsUrl(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Certificate
                </a>
              </div>
            ) : (
              renderValue(value)
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading IPFS data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-900">Error</h2>
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-600">
              Make sure the CID is correct and the file is accessible on IPFS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!jsonData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <p className="text-gray-600">No data to display.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">IPFS Batch Details</h1>
            {cid && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">CID:</span> {cid}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Batch/Drug Information</h2>
          
          <div className="space-y-4">
            {Object.entries(jsonData).map(([key, value]) => 
              renderField(key, value)
            )}
          </div>

          {/* Certificate Links Section */}
          {jsonData.certificates && (
            <div className="mt-8 pt-6 border-t-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Certificates</h3>
              <div className="space-y-3">
                {Array.isArray(jsonData.certificates) ? (
                  jsonData.certificates.map((cert, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <a
                        href={ipfsUrl(cert)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Certificate {index + 1}: {cert}
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <a
                      href={ipfsUrl(jsonData.certificates)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Certificate: {jsonData.certificates}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Check for certificate CID in common field names */}
          {jsonData.certificateCID && (
            <div className="mt-8 pt-6 border-t-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Certificate</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <a
                  href={ipfsUrl(jsonData.certificateCID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Certificate: {jsonData.certificateCID}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IpfsViewPage;

