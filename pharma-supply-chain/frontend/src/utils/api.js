// API utility for MongoDB backend communication
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Batch operations
  async createBatch(batchData, qaCertificateFile = null) {
    const formData = new FormData();
    
    // Append all batch fields
    Object.keys(batchData).forEach(key => {
      if (batchData[key] !== null && batchData[key] !== undefined) {
        formData.append(key, batchData[key]);
      }
    });

    // Append QA certificate if provided
    if (qaCertificateFile) {
      formData.append('qaCertificate', qaCertificateFile);
    }

    const response = await fetch(`${this.baseURL}/batches`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create batch');
    }
    
    return data;
  }

  async getBatch(batchId) {
    return this.request(`/batches/${batchId}`);
  }

  async getAllBatches(filters = {}) {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const queryString = queryParams.toString();
    return this.request(`/batches${queryString ? `?${queryString}` : ''}`);
  }

  async updateBatch(batchId, updates) {
    return this.request(`/batches/${batchId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async recordTransfer(batchId, transferData) {
    return this.request(`/batches/${batchId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(transferData)
    });
  }

  async getTransferHistory(batchId) {
    return this.request(`/batches/${batchId}/history`);
  }

  // Verification operations
  async verifyProduct(qrData, tokenId = null, batchID = null) {
    return this.request('/verify', {
      method: 'POST',
      body: JSON.stringify({ qrData, tokenId, batchID })
    });
  }

  async quickVerify(batchId) {
    return this.request(`/verify/${batchId}`);
  }

  // Metadata operations
  async getMetadata(batchId) {
    return this.request(`/metadata/${batchId}`);
  }

  async verifyMetadata(metadata, tokenId = null, batchID = null) {
    return this.request('/metadata/verify', {
      method: 'POST',
      body: JSON.stringify({ metadata, tokenId, batchID })
    });
  }

  // QR operations
  async storeQRData(tokenId, batchID, qrData, qrSignature) {
    return this.request('/qr', {
      method: 'POST',
      body: JSON.stringify({ tokenId, batchID, qrData, qrSignature })
    });
  }

  async getQRData(batchId) {
    return this.request(`/qr/${batchId}`);
  }

  // Transfer operations
  async getAllTransfers(filters = {}) {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const queryString = queryParams.toString();
    return this.request(`/transfers${queryString ? `?${queryString}` : ''}`);
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

const apiService = new ApiService();
export default apiService;


