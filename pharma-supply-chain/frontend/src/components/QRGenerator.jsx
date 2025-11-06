// Upload JSON to IPFS Desktop → copy CID → paste here → generate QR.
import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { ipfsUrl } from '../utils/ipfsGateway';

const QRGenerator = () => {
  const [cid, setCid] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  const generateQR = async () => {
    if (!cid || !cid.trim()) {
      setError('Please enter a CID');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const url = ipfsUrl(cid.trim());
      
      // Generate QR code as data URL
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrDataUrl(dataUrl);
      
      // Also render to canvas for download
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, url, {
          width: 400,
          margin: 2
        });
      }
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code: ' + err.message);
      setQrDataUrl('');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${cid || 'ipfs'}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">IPFS QR Code Generator</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Certificate CID or JSON CID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="Paste CID here (e.g., QmXxxx...)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={generateQR}
                disabled={loading || !cid.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Generating...' : 'Generate QR'}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          {qrDataUrl && (
            <div className="mt-6">
              <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">QR Code</h3>
                <img 
                  src={qrDataUrl} 
                  alt="QR Code" 
                  className="mb-4 border-2 border-gray-200 rounded-lg"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="text-sm text-gray-600 mb-4 text-center break-all">
                  <strong>URL:</strong> {ipfsUrl(cid.trim())}
                </div>
                <button
                  onClick={downloadQR}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download QR Code
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Instructions:</strong> Upload your JSON file to IPFS Desktop, copy the CID, paste it above, and generate a QR code that points to the IPFS gateway URL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;

