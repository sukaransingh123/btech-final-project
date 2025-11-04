const crypto = require('crypto');

/**
 * Generate SHA-256 hash of metadata
 * @param {Object} metadata - The metadata object to hash
 * @returns {String} - Hexadecimal hash string
 */
function generateMetadataHash(metadata) {
  // Normalize the metadata object (sort keys for consistency)
  // Dates should be in YYYY-MM-DD format, manufacturer lowercase
  const normalized = {
    batchID: String(metadata.batchID || ''),
    drugName: String(metadata.drugName || ''),
    manufacturingDate: metadata.manufacturingDate instanceof Date
      ? metadata.manufacturingDate.toISOString().split('T')[0]
      : metadata.manufacturingDate ? new Date(metadata.manufacturingDate).toISOString().split('T')[0] : '',
    expiryDate: metadata.expiryDate instanceof Date
      ? metadata.expiryDate.toISOString().split('T')[0]
      : metadata.expiryDate ? new Date(metadata.expiryDate).toISOString().split('T')[0] : '',
    quantity: Number(metadata.quantity || 1),
    manufacturer: String(metadata.manufacturer || '').toLowerCase()
  };
  
  // Sort keys for consistency
  const sortedKeys = Object.keys(normalized).sort();
  const metadataString = JSON.stringify(normalized, sortedKeys);
  return crypto.createHash('sha256').update(metadataString).digest('hex');
}

/**
 * Verify metadata hash integrity
 * @param {Object} metadata - The metadata object
 * @param {String} storedHash - The hash stored on blockchain
 * @returns {Boolean} - True if hash matches
 */
function verifyMetadataHash(metadata, storedHash) {
  const computedHash = generateMetadataHash(metadata);
  return computedHash === storedHash;
}

/**
 * Generate hash for file content
 * @param {Buffer} fileBuffer - File content as buffer
 * @returns {String} - Hexadecimal hash string
 */
function generateFileHash(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Verify file hash integrity
 * @param {Buffer} fileBuffer - Current file content
 * @param {String} storedHash - Previously computed hash
 * @returns {Boolean} - True if hash matches
 */
function verifyFileHash(fileBuffer, storedHash) {
  const computedHash = generateFileHash(fileBuffer);
  return computedHash === storedHash;
}

module.exports = {
  generateMetadataHash,
  verifyMetadataHash,
  generateFileHash,
  verifyFileHash
};


