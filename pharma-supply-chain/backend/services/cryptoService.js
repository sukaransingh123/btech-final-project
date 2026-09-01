/**
 * cryptoService.js — Asymmetric Cryptographic Service
 *
 * Implements ECDSA key generation, payload signing, and signature verification
 * using ethers.js v6 (secp256k1 elliptic curve — same as Ethereum).
 *
 * Every batch handoff is signed by the transferring stakeholder's private key.
 * The resulting signature is stored off-chain (MongoDB) and can be verified
 * on-chain via ecrecover or off-chain via ethers.verifyMessage().
 */

'use strict';

const { ethers } = require('ethers');
const crypto     = require('crypto');

// ══════════════════════════════════════════════════════════════
//  STAGE & ROLE MAPPINGS
// ══════════════════════════════════════════════════════════════

const STAGE_NAMES = {
  0: 'Produced',
  1: 'Shipped',
  2: 'InTransit',
  3: 'Delivered',
  4: 'Dispensed',
};

const ROLE_NAMES = {
  0: 'None',
  1: 'Supplier',
  2: 'Manufacturer',
  3: 'Distributor',
  4: 'Pharmacy',
  5: 'Consumer',
};

// ══════════════════════════════════════════════════════════════
//  KEY GENERATION
// ══════════════════════════════════════════════════════════════

/**
 * Generates a fresh secp256k1 key pair (Ethereum-compatible).
 * In production each stakeholder generates their own key pair securely;
 * private keys are NEVER transmitted or stored on the server.
 *
 * @returns {{ privateKey: string, publicKey: string, address: string }}
 */
function generateKeyPair() {
  const wallet = ethers.Wallet.createRandom();
  return {
    privateKey : wallet.privateKey,   // 0x-prefixed hex
    publicKey  : wallet.publicKey,    // 0x-prefixed compressed pubkey
    address    : wallet.address,      // checksummed Ethereum address
  };
}

/**
 * Derives the Ethereum address from a private key.
 * @param {string} privateKey — 0x-prefixed hex private key
 * @returns {string} checksummed Ethereum address
 */
function addressFromPrivateKey(privateKey) {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

// ══════════════════════════════════════════════════════════════
//  PAYLOAD CONSTRUCTION
// ══════════════════════════════════════════════════════════════

/**
 * Creates a deterministic, human-readable transfer payload string.
 * Both signer and verifier must construct the payload identically.
 *
 * @param {object} params
 * @param {number|string} params.batchId      — on-chain batch ID
 * @param {string}        params.drugName     — name of the drug
 * @param {string}        params.fromAddress  — sender's wallet address
 * @param {string}        params.toAddress    — receiver's wallet address
 * @param {string}        params.fromRole     — role name of sender
 * @param {string}        params.toRole       — role name of receiver
 * @param {string}        params.stage        — stage name after this transfer
 * @param {number}        params.timestamp    — Unix timestamp (seconds)
 * @param {string}        params.txHash       — blockchain tx hash (optional)
 * @returns {string} canonical payload string ready to sign
 */
function createTransferPayload({
  batchId,
  drugName,
  fromAddress,
  toAddress,
  fromRole,
  toRole,
  stage,
  timestamp,
  txHash = '',
}) {
  // Normalise inputs
  const normalised = {
    batchId    : String(batchId),
    drugName   : drugName.trim(),
    fromAddress: fromAddress.toLowerCase(),
    toAddress  : toAddress.toLowerCase(),
    fromRole   : fromRole.trim(),
    toRole     : toRole.trim(),
    stage      : stage.trim(),
    timestamp  : String(timestamp),
    txHash     : (txHash || '').toLowerCase(),
  };

  // Canonical JSON — keys sorted alphabetically for determinism
  return JSON.stringify(normalised, Object.keys(normalised).sort());
}

/**
 * Returns the keccak256 hash of a payload string (32-byte hex).
 * This matches what Solidity's keccak256(abi.encodePacked(...)) returns
 * for the same string content.
 */
function hashPayload(payloadString) {
  return ethers.keccak256(ethers.toUtf8Bytes(payloadString));
}

// ══════════════════════════════════════════════════════════════
//  SIGNING
// ══════════════════════════════════════════════════════════════

/**
 * Signs a transfer payload with the stakeholder's private key.
 *
 * Uses EIP-191 personal_sign (prefixed message hash) so that:
 * - MetaMask / frontend wallets can produce the same signature.
 * - ethers.verifyMessage() and Solidity's ecrecover both work.
 *
 * @param {string} privateKey     — 0x-prefixed hex private key
 * @param {object} payloadParams  — same params as createTransferPayload()
 * @returns {Promise<{signature: string, payloadHash: string, payload: string, signer: string}>}
 */
async function signTransferPayload(privateKey, payloadParams) {
  const wallet      = new ethers.Wallet(privateKey);
  const payload     = createTransferPayload(payloadParams);
  const payloadHash = hashPayload(payload);

  // Sign the raw bytes of the hash (ethers adds EIP-191 prefix internally)
  const signature   = await wallet.signMessage(ethers.getBytes(payloadHash));

  return {
    signature,          // 65-byte 0x-prefixed hex ECDSA signature
    payloadHash,        // keccak256 of payload (32-byte hex)
    payload,            // original JSON string (for logging / audit)
    signer: wallet.address,
  };
}

/**
 * Signs an arbitrary message string (used for batch creation / raw material).
 *
 * @param {string} privateKey — 0x-prefixed hex private key
 * @param {string} message    — plaintext or JSON string to sign
 * @returns {Promise<{signature: string, messageHash: string, signer: string}>}
 */
async function signMessage(privateKey, message) {
  const wallet      = new ethers.Wallet(privateKey);
  const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
  const signature   = await wallet.signMessage(ethers.getBytes(messageHash));
  return { signature, messageHash, signer: wallet.address };
}

// ══════════════════════════════════════════════════════════════
//  VERIFICATION
// ══════════════════════════════════════════════════════════════

/**
 * Verifies an ECDSA signature against a transfer payload.
 *
 * Off-chain verification: recovers the signer address and compares
 * it against the expected (registered) stakeholder address.
 *
 * @param {string} signature        — 0x-prefixed 65-byte hex signature
 * @param {object} payloadParams    — same params as createTransferPayload()
 * @param {string} expectedAddress  — the registered stakeholder's Ethereum address
 * @returns {{ valid: boolean, recoveredAddress: string, expectedAddress: string, payloadHash: string }}
 */
function verifyTransferSignature(signature, payloadParams, expectedAddress) {
  try {
    const payload          = createTransferPayload(payloadParams);
    const payloadHash      = hashPayload(payload);
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(payloadHash), signature);

    return {
      valid            : recoveredAddress.toLowerCase() === expectedAddress.toLowerCase(),
      recoveredAddress,
      expectedAddress  : ethers.getAddress(expectedAddress),   // checksummed
      payloadHash,
      payload,
    };
  } catch (err) {
    return {
      valid            : false,
      recoveredAddress : null,
      expectedAddress,
      error            : err.message,
    };
  }
}

/**
 * Verifies a generic signed message.
 *
 * @param {string} signature        — 0x-prefixed hex signature
 * @param {string} message          — original plaintext / JSON message
 * @param {string} expectedAddress  — expected signer's Ethereum address
 * @returns {{ valid: boolean, recoveredAddress: string }}
 */
function verifyMessageSignature(signature, message, expectedAddress) {
  try {
    const messageHash      = ethers.keccak256(ethers.toUtf8Bytes(message));
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    return {
      valid: recoveredAddress.toLowerCase() === expectedAddress.toLowerCase(),
      recoveredAddress,
    };
  } catch (err) {
    return { valid: false, recoveredAddress: null, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  BATCH PAYLOAD HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * Creates and signs a batch-creation payload (used when supplier adds raw material).
 * @param {string} privateKey
 * @param {{ batchId: number, drugName: string, supplierAddress: string, timestamp: number }} params
 */
async function signBatchCreation(privateKey, { batchId, drugName, supplierAddress, timestamp }) {
  const message = JSON.stringify({
    action      : 'ADD_RAW_MATERIAL',
    batchId     : String(batchId),
    drugName    : drugName.trim(),
    supplier    : supplierAddress.toLowerCase(),
    timestamp   : String(timestamp || Math.floor(Date.now() / 1000)),
  });
  return signMessage(privateKey, message);
}

/**
 * Builds a structured audit record combining on-chain tx data with off-chain signature.
 * This is stored in MongoDB for tamper-evident history.
 *
 * @param {object} txReceipt       — ethers.js transaction receipt
 * @param {object} cryptoResult    — return value of signTransferPayload()
 * @param {string} action          — action name (e.g., 'MANUFACTURE', 'TRANSFER_DISTRIBUTOR')
 * @returns {object} audit record
 */
function buildAuditRecord(txReceipt, cryptoResult, action) {
  return {
    action,
    txHash          : txReceipt.hash,
    blockNumber     : txReceipt.blockNumber,
    gasUsed         : txReceipt.gasUsed.toString(),
    signer          : cryptoResult.signer,
    signature       : cryptoResult.signature,
    payloadHash     : cryptoResult.payloadHash,
    payload         : cryptoResult.payload,
    timestamp       : new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
//  UTILITY
// ══════════════════════════════════════════════════════════════

/**
 * Generates a SHA-256 fingerprint of arbitrary data (used for metadata integrity).
 * @param {object|string} data
 * @returns {string} hex digest
 */
function sha256Fingerprint(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
  // Key management
  generateKeyPair,
  addressFromPrivateKey,

  // Payload construction
  createTransferPayload,
  hashPayload,

  // Signing
  signTransferPayload,
  signMessage,
  signBatchCreation,

  // Verification
  verifyTransferSignature,
  verifyMessageSignature,

  // Audit
  buildAuditRecord,

  // Utilities
  sha256Fingerprint,
  STAGE_NAMES,
  ROLE_NAMES,
};
