'use strict';

const express = require('express');
const { fromEnvironment } = require('../services/supplyChainService');
const SupplyChainAudit = require('../models/SupplyChainAudit');

const router = express.Router();

function bridge(res) {
  try { return fromEnvironment(); }
  catch (error) { res.status(503).json({ success: false, error: error.message }); return null; }
}

// Public endpoint used by the consumer/inspector tracker.
router.get('/batches/:batchId/provenance', async (req, res, next) => {
  const service = bridge(res); if (!service) return;
  try { res.json({ success: true, ...(await service.getBatchProvenance(req.params.batchId)) }); }
  catch (error) { next(error); }
});

// Public verification endpoint. Signatures are supplied by the client/audit store;
// no private key is accepted or persisted by this API.
router.post('/batches/:batchId/verify', async (req, res, next) => {
  const service = bridge(res); if (!service) return;
  try {
    const signedTransitions = req.body.signedTransitions || await SupplyChainAudit.find({ batchId: String(req.params.batchId) }).lean();
    res.json({ success: true, ...(await service.verifyBatchAuthenticity(req.params.batchId, signedTransitions)) });
  }
  catch (error) { next(error); }
});

// Saves only public audit data: payload, signature and transaction hash. Never a private key.
router.post('/batches/:batchId/audits', async (req, res, next) => {
  try {
    const { action, signature, payload, expectedAddress, txHash } = req.body;
    if (!action || !signature || !payload || !expectedAddress || !txHash) throw new Error('Incomplete signed audit record');
    const audit = await SupplyChainAudit.create({ batchId: String(req.params.batchId), action, signature, payload, expectedAddress, txHash });
    res.status(201).json({ success: true, audit });
  } catch (error) { next(error); }
});

module.exports = router;
