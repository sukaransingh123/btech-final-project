'use strict';
const mongoose = require('mongoose');

const SupplyChainAuditSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  signature: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  expectedAddress: { type: String, required: true },
  txHash: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('SupplyChainAudit', SupplyChainAuditSchema);
