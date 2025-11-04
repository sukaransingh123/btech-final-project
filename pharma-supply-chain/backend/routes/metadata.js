const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const { verifyMetadataHash } = require('../utils/hashUtil');

/**
 * GET /api/metadata/:id - Get metadata for a batch
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let batch;
    if (!isNaN(id)) {
      batch = await Batch.findByTokenId(parseInt(id));
    } else {
      batch = await Batch.findByBatchID(id);
    }

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Verify hash integrity
    const hashValid = batch.verifyHashIntegrity();

    res.json({
      success: true,
      metadata: {
        batchID: batch.batchID,
        tokenId: batch.tokenId,
        drugName: batch.drugName,
        manufacturingDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity,
        manufacturer: batch.manufacturer,
        manufacturerName: batch.manufacturerName,
        metadataHash: batch.metadataHash,
        qaCertificateUrl: batch.qaCertificateUrl,
        qaCertificateHash: batch.qaCertificateHash,
        currentOwner: batch.currentOwner,
        currentRole: batch.currentRole,
        status: batch.status,
        createdAt: batch.createdAt
      },
      hashValid,
      message: hashValid 
        ? 'Metadata hash verified' 
        : '⚠️ Warning: Metadata hash mismatch detected'
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata', message: error.message });
  }
});

/**
 * POST /api/metadata/verify - Verify metadata integrity
 */
router.post('/verify', async (req, res) => {
  try {
    const { tokenId, batchID, metadata } = req.body;

    if (!metadata) {
      return res.status(400).json({ error: 'Metadata object required' });
    }

    let batch;
    if (tokenId) {
      batch = await Batch.findByTokenId(parseInt(tokenId));
    } else if (batchID) {
      batch = await Batch.findByBatchID(batchID);
    } else {
      return res.status(400).json({ error: 'tokenId or batchID required' });
    }

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Verify hash
    const isValid = verifyMetadataHash(metadata, batch.metadataHash);

    res.json({
      success: true,
      valid: isValid,
      storedHash: batch.metadataHash,
      message: isValid 
        ? '✅ Metadata integrity verified' 
        : '❌ Metadata hash mismatch - possible tampering'
    });
  } catch (error) {
    console.error('Error verifying metadata:', error);
    res.status(500).json({ error: 'Verification failed', message: error.message });
  }
});

module.exports = router;


