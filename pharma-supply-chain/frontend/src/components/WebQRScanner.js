import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanType } from 'html5-qrcode';

const WebQRScanner = ({ onDetected, onClose }) => {
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [cameraId, setCameraId] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scanningRef = useRef(false); // Use ref to track scanning state in cleanup

  useEffect(() => {
    let html5QrCode = null;
    let isMounted = true;
    let isInitializing = false;
    let startPromise = null;

    const startScanning = async () => {
      // Prevent double initialization
      if (isInitializing) {
        console.log('Scanner already initializing, skipping...');
        return;
      }
      
      try {
        isInitializing = true;
        setLoading(true);
        setError('');

        // Wait a bit to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if component is still mounted
        if (!isMounted) {
          console.log('Component unmounted during initialization, aborting...');
          return;
        }

        // Create Html5Qrcode instance
        // Use the container element directly
        const scannerElementId = 'html5qr-scanner';
        
        // Wait for ref to be available
        let retries = 0;
        while (!scannerRef.current && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
          retries++;
          if (!isMounted) {
            console.log('Component unmounted while waiting for ref, aborting...');
            return;
          }
        }
        
        if (!scannerRef.current) {
          throw new Error('Scanner container not found');
        }
        
        // Set ID - container is already visible in DOM
        scannerRef.current.id = scannerElementId;
        
        // Clean up any existing instance
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop().catch(() => {});
            await html5QrCodeRef.current.clear().catch(() => {});
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        html5QrCode = new Html5Qrcode(scannerElementId);
        html5QrCodeRef.current = html5QrCode;

        // Get available cameras
        const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
          throw new Error('No cameras found. Please ensure your device has a camera and permissions are granted.');
        }

        // Prefer back camera (environment) for mobile, fallback to first available
        let selectedCameraId = null;
        const backCamera = cameras.find(cam => cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('rear'));
        const environmentCamera = cameras.find(cam => cam.label.toLowerCase().includes('environment'));
        
        if (environmentCamera) {
          selectedCameraId = environmentCamera.id;
        } else if (backCamera) {
          selectedCameraId = backCamera.id;
        } else {
          selectedCameraId = cameras[0].id;
        }

        setCameraId(selectedCameraId);

        // Check again if mounted before starting
        if (!isMounted) {
          console.log('Component unmounted before starting camera, aborting...');
          return;
        }

        // Start scanning - OPTIMIZED FOR DENSE QR CODES
        startPromise = html5QrCode.start(
          selectedCameraId,
          {
            fps: 30, // Higher FPS for better detection of dense QR codes
            qrbox: function(viewfinderWidth, viewfinderHeight) {
              // Use 90% for dense QR codes - need more area
              const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.9;
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
            disableFlip: true, // Disable flip for better performance with dense codes
            // Better video quality for dense QR codes
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 }
            }
          },
          (decodedText, decodedResult) => {
            // QR code detected!
            console.log('✅✅✅ QR DETECTED! Length:', decodedText.length);
            if (isMounted) {
              handleScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Log ALL errors for debugging dense QR codes
            if (errorMessage) {
              // Don't spam console with "not found" but log occasionally
              if (!errorMessage.includes('No QR code found') && 
                  !errorMessage.includes('NotFoundException')) {
                console.log('⚠️ Scanner error:', errorMessage);
              }
            }
          }
        ).catch((err) => {
          // Handle play() interruption and other initialization errors
          if (isMounted) {
            console.warn('Scanner start interrupted:', err.message);
            // Only show error if it's not a play interruption (common in React Strict Mode)
            if (!err.message.includes('play()') && !err.message.includes('interrupted')) {
              setError(`Camera initialization error: ${err.message}`);
            }
            setLoading(false);
            setScanning(false);
            scanningRef.current = false;
          }
        });

        // Wait for start to complete
        await startPromise;

        if (isMounted) {
          console.log('✅ Scanner started successfully');
          setScanning(true);
          scanningRef.current = true;
          setLoading(false);
          isInitializing = false;
        }
      } catch (err) {
        console.error('Error starting QR scanner:', err);
        isInitializing = false;
        if (isMounted) {
          setLoading(false);
          setScanning(false);
          scanningRef.current = false;
          
          // Provide user-friendly error messages
          if (err.name === 'NotAllowedError' || err.message.includes('permission')) {
            setError('Camera permission denied. Please allow camera access and try again.');
          } else if (err.name === 'NotFoundError' || err.message.includes('No cameras')) {
            setError('No camera found. Please ensure your device has a camera.');
          } else if (err.name === 'NotReadableError' || err.message.includes('not readable')) {
            setError('Camera is already in use by another application. Please close other apps using the camera.');
          } else if (err.message && err.message.includes('play()')) {
            // Ignore play() interruption errors - they're common in React Strict Mode
            console.log('Play interruption (likely React Strict Mode), will retry...');
            setError('');
          } else {
            setError(`Camera error: ${err.message || 'Unable to access camera'}`);
          }
        }
      }
    };

    const handleScanSuccess = (decodedText) => {
      console.log('✅ QR DETECTED:', decodedText.substring(0, 100));
      
      // Stop scanning
      stopScanning();
      
      // Process: If URL with data param, extract it. Otherwise use as-is.
      let processedText = decodedText;
      
      if (decodedText && decodedText.includes('data=')) {
        try {
          const url = decodedText.startsWith('http') 
            ? new URL(decodedText) 
            : new URL(decodedText, window.location.origin);
          const dataParam = url.searchParams.get('data');
          if (dataParam) {
            try {
              processedText = decodeURIComponent(escape(atob(dataParam)));
            } catch {
              processedText = atob(dataParam);
            }
          }
        } catch {
          // Not a URL or decode failed - use original
        }
      }
      
      // Send to callback
      if (onDetected) {
        onDetected(processedText);
      }
    };

    const stopScanning = async () => {
      // Use ref to check scanning state (works in cleanup)
      if (html5QrCodeRef.current && scanningRef.current) {
        try {
          await html5QrCodeRef.current.stop();
          await html5QrCodeRef.current.clear();
        } catch (err) {
          // Ignore errors when stopping (camera might already be released)
          console.log('Error stopping scanner:', err);
        }
        if (isMounted) {
          setScanning(false);
          scanningRef.current = false;
        }
      }
      // Always return a promise to avoid undefined.catch() errors
      return Promise.resolve();
    };

    // Start scanning when component mounts
    startScanning();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      isInitializing = false;
      
      // Cancel any pending start promise
      if (startPromise) {
        startPromise.catch(() => {}); // Ignore cancellation errors
      }
      
      // Safely stop scanning
      const stopPromise = stopScanning();
      if (stopPromise && typeof stopPromise.catch === 'function') {
        stopPromise.catch(() => {});
      }
      
      // Wait a bit before clearing to allow video to stop
      setTimeout(() => {
        // Safely clear scanner
        if (html5QrCodeRef.current) {
          try {
            const clearPromise = html5QrCodeRef.current.clear();
            if (clearPromise && typeof clearPromise.catch === 'function') {
              clearPromise.catch(() => {});
            }
          } catch (err) {
            // Ignore errors during cleanup (video might already be removed)
            console.log('Error clearing scanner (ignored):', err.message);
          }
        }
      }, 100);
    };
  }, []); // Empty deps - only run on mount

  const handleClose = async () => {
    // Stop scanning before closing
    if (html5QrCodeRef.current && scanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        // Ignore errors when stopping (camera might already be released)
        console.log('Error stopping scanner on close:', err);
      }
    }
    setScanning(false);
    scanningRef.current = false;
    if (onClose) {
      onClose();
    }
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.9)', 
        zIndex: 1000, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        style={{ 
          width: '100%', 
          maxWidth: 500, 
          background: '#1a1a1a', 
          borderRadius: 12, 
          padding: 20, 
          color: '#fff', 
          position: 'relative',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={handleClose}
          style={{ 
            position: 'absolute', 
            right: 12, 
            top: 12,
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 'bold',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
        >
          ×
        </button>

        <h2 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 'bold' }}>Scan QR Code</h2>
        
        {/* Error Message */}
        {error && (
          <div 
            style={{ 
              marginBottom: 16, 
              padding: 12, 
              background: 'rgba(220, 53, 69, 0.2)', 
              border: '1px solid rgba(220, 53, 69, 0.5)',
              borderRadius: 8,
              color: '#ff6b6b'
            }}
          >
            {error}
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              You can still paste the QR code data manually in the text area below.
            </div>
          </div>
        )}


        {/* Scanner Container - Always render for proper video initialization */}
        <div 
          style={{
            width: '100%',
            minHeight: 300,
            maxHeight: 500,
            borderRadius: 8,
            overflow: 'hidden',
            background: '#000',
            position: 'relative'
          }}
        >
          <div 
            ref={scannerRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 300,
              position: 'relative'
            }}
          />
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              zIndex: 10
            }}>
              <div 
                style={{
                  width: 40,
                  height: 40,
                  border: '4px solid rgba(255,255,255,0.2)',
                  borderTop: '4px solid #fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: 16
                }}
              />
              <p style={{ margin: 0, color: '#ccc' }}>Initializing camera...</p>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        {scanning && !loading && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: 'rgba(34, 197, 94, 0.1)', 
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 8,
            color: '#22c55e',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 2s infinite'
            }} />
            <span>Camera active • Scanning for QR codes...</span>
          </div>
        )}

        {/* Instructions */}
        <div style={{ marginTop: 16, fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Instructions:</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Point your camera at the QR code</li>
            <li>Ensure good lighting and steady hands</li>
            <li>Keep the QR code within the scanning frame</li>
            <li>Hold the QR code steady for 1-2 seconds</li>
            <li>If scanning fails, use the "Paste" option below</li>
          </ul>
          {scanning && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888', fontStyle: 'italic' }}>
              💡 Tip: Make sure the QR code fills most of the scanning frame for best results.
            </p>
          )}
        </div>
      </div>

      {/* Add CSS for animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default WebQRScanner;

