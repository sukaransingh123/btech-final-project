const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');

/**
 * POST /api/qr - Store QR code data for a batch
 */
router.post('/', async (req, res) => {
  try {
    const { tokenId, batchID, qrData, qrSignature } = req.body;

    if (!qrData || !qrSignature) {
      return res.status(400).json({ error: 'QR data and signature required' });
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

    batch.qrData = qrData;
    batch.qrSignature = qrSignature;
    batch.updatedAt = new Date();
    await batch.save();

    res.json({
      success: true,
      batch,
      message: 'QR code data stored successfully'
    });
  } catch (error) {
    console.error('Error storing QR data:', error);
    res.status(500).json({ error: 'Failed to store QR data', message: error.message });
  }
});

/**
 * GET /api/qr/:id - Get QR code data for a batch
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

    res.json({
      success: true,
      qrData: batch.qrData,
      qrSignature: batch.qrSignature,
      batchID: batch.batchID,
      tokenId: batch.tokenId
    });
  } catch (error) {
    console.error('Error fetching QR data:', error);
    res.status(500).json({ error: 'Failed to fetch QR data', message: error.message });
  }
});

module.exports = router;


