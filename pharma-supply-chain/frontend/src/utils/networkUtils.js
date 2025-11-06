// Utility to get the network IP address for localhost testing from mobile devices

/**
 * Gets the local network IP address for accessing localhost from mobile devices
 * This is useful for development when you want to test QR codes from your phone
 */
export const getNetworkIP = async () => {
  // Try to get IP from WebRTC (works in most browsers)
  return new Promise((resolve) => {
    const RTCPeerConnection = window.RTCPeerConnection || 
                             window.mozRTCPeerConnection || 
                             window.webkitRTCPeerConnection;
    
    if (!RTCPeerConnection) {
      // Fallback: return null, will use localhost
      resolve(null);
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.createDataChannel('');
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        // Match IPv4 addresses
        const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (match) {
          const ip = match[1];
          // Filter out common invalid IPs
          if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
            pc.close();
            resolve(ip);
            return;
          }
        }
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => {
        pc.close();
        resolve(null);
      });

    // Timeout after 2 seconds
    setTimeout(() => {
      pc.close();
      resolve(null);
    }, 2000);
  });
};

/**
 * Gets the base URL for QR codes, using network IP in development mode
 */
export const getBaseUrl = async () => {
  // Check if we have an environment variable set
  if (process.env.REACT_APP_PUBLIC_BASE_URL && 
      process.env.REACT_APP_PUBLIC_BASE_URL.startsWith('http')) {
    return process.env.REACT_APP_PUBLIC_BASE_URL;
  }

  // In development, try to get network IP for mobile testing
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const networkIP = await getNetworkIP();
    if (networkIP) {
      const port = window.location.port || '3000';
      return `http://${networkIP}:${port}`;
    }
  }

  // Fallback to current origin
  return window.location.origin;
};


