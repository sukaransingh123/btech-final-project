const mongoose = require('mongoose');

const TransferHistorySchema = new mongoose.Schema({
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  fromRole: {
    type: String,
    enum: ['Manufacturer', 'Distributor', 'Retailer', 'Pharmacy'],
    required: true
  },
  toRole: {
    type: String,
    enum: ['Manufacturer', 'Distributor', 'Retailer', 'Pharmacy'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  txHash: {
    type: String,
    default: null
  }
}, { _id: false });

const BatchSchema = new mongoose.Schema({
  // On-chain identifiers
  tokenId: {
    type: Number,
    required: false, // Will be set after NFT mint
    unique: true,
    sparse: true, // Allow null values for uniqueness
    index: true
  },
  batchID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  
  // Current state
  currentOwner: {
    type: String,
    required: true,
    index: true
  },
  currentRole: {
    type: String,
    enum: ['Manufacturer', 'Distributor', 'Retailer', 'Pharmacy'],
    required: true,
    default: 'Manufacturer'
  },
  
  // Manufacturer info
  manufacturer: {
    type: String,
    required: true
  },
  manufacturerName: {
    type: String,
    default: ''
  },
  
  // Product metadata
  drugName: {
    type: String,
    required: true
  },
  manufacturingDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  
  // Cryptographic hashes
  metadataHash: {
    type: String,
    required: true,
    index: true
  },
  qaCertificateHash: {
    type: String,
    default: null
  },
  
  // File references
  qaCertificateUrl: {
    type: String,
    default: null
  },
  metadataURI: {
    type: String,
    default: null
  },
  
  // MongoDB reference (for linking)
  mongoRef: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return this._id.toString();
    }
  },
  
  // Parent-child relationships
  parentBatchId: {
    type: Number,
    default: null,
    index: true
  },
  childBatchIds: [{
    type: Number,
    default: []
  }],
  
  // Transfer history
  history: {
    type: [TransferHistorySchema],
    default: []
  },
  
  // QR code data
  qrSignature: {
    type: String,
    default: null
  },
  qrData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Status flags
  status: {
    type: String,
    enum: ['Created', 'InTransit', 'InStore', 'Delivered', 'Flagged'],
    default: 'Created'
  },
  isCounterfeit: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
BatchSchema.index({ currentOwner: 1, status: 1 });
BatchSchema.index({ manufacturer: 1, createdAt: -1 });
BatchSchema.index({ metadataHash: 1 });

// Method to compute metadata hash
BatchSchema.methods.computeMetadataHash = function() {
  const crypto = require('crypto');
  // Normalize dates to ISO strings for consistent hashing
  const normalized = {
    batchID: String(this.batchID || ''),
    drugName: String(this.drugName || ''),
    manufacturingDate: this.manufacturingDate instanceof Date 
      ? this.manufacturingDate.toISOString().split('T')[0] // YYYY-MM-DD format
      : new Date(this.manufacturingDate).toISOString().split('T')[0],
    expiryDate: this.expiryDate instanceof Date 
      ? this.expiryDate.toISOString().split('T')[0] // YYYY-MM-DD format
      : new Date(this.expiryDate).toISOString().split('T')[0],
    quantity: Number(this.quantity || 1),
    manufacturer: String(this.manufacturer || '').toLowerCase()
  };
  // Sort keys for consistency
  const sortedKeys = Object.keys(normalized).sort();
  const metadataString = JSON.stringify(normalized, sortedKeys);
  return crypto.createHash('sha256').update(metadataString).digest('hex');
};

// Method to verify hash integrity
BatchSchema.methods.verifyHashIntegrity = function() {
  const computedHash = this.computeMetadataHash();
  return computedHash === this.metadataHash;
};

// Static method to find by batchID
BatchSchema.statics.findByBatchID = function(batchID) {
  return this.findOne({ batchID });
};

// Static method to find by tokenId
BatchSchema.statics.findByTokenId = function(tokenId) {
  return this.findOne({ tokenId });
};

// Static method to find batches by owner
BatchSchema.statics.findByOwner = function(ownerAddress) {
  return this.find({ currentOwner: ownerAddress.toLowerCase() });
};

const Batch = mongoose.model('Batch', BatchSchema);

module.exports = Batch;

