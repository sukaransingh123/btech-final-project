const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');

/**
 * GET /api/transfers - Get all transfers (with optional filters)
 */
router.get('/', async (req, res) => {
  try {
    const { tokenId, batchID, from, to } = req.query;

    let batch;
    if (tokenId) {
      batch = await Batch.findByTokenId(parseInt(tokenId));
    } else if (batchID) {
      batch = await Batch.findByBatchID(batchID);
    }

    if (!batch) {
      // If specific batch not found, return all transfers from all batches
      const batches = await Batch.find({}).select('batchID tokenId history');
      const allTransfers = batches.flatMap(b => 
        b.history.map(h => ({
          batchID: b.batchID,
          tokenId: b.tokenId,
          ...h.toObject()
        }))
      );

      // Apply filters
      let filtered = allTransfers;
      if (from) {
        filtered = filtered.filter(t => t.from.toLowerCase() === from.toLowerCase());
      }
      if (to) {
        filtered = filtered.filter(t => t.to.toLowerCase() === to.toLowerCase());
      }

      return res.json({ success: true, transfers: filtered, count: filtered.length });
    }

    // Apply filters to batch history
    let transfers = batch.history;
    if (from) {
      transfers = transfers.filter(t => t.from.toLowerCase() === from.toLowerCase());
    }
    if (to) {
      transfers = transfers.filter(t => t.to.toLowerCase() === to.toLowerCase());
    }

    res.json({
      success: true,
      batchID: batch.batchID,
      tokenId: batch.tokenId,
      transfers,
      count: transfers.length
    });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ error: 'Failed to fetch transfers', message: error.message });
  }
});

module.exports = router;


