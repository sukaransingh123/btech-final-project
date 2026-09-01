/**
 * Bridge for the Phase 1 PharmaSupplyChain contract.
 *
 * This module deliberately accepts an ethers Signer from the caller rather than
 * keeping stakeholder private keys on the API server.  In the web app MetaMask
 * is the signer; tests use Hardhat signers.
 */
'use strict';

const { ethers } = require('ethers');
const cryptoService = require('./cryptoService');

const STAGES = ['Produced', 'Shipped', 'InTransit', 'Delivered', 'Dispensed'];
const ROLES = ['None', 'Supplier', 'Manufacturer', 'Distributor', 'Pharmacy', 'Consumer'];

function serialise(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => Number.isNaN(Number(key))).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

class SupplyChainService {
  constructor(contract) {
    if (!contract) throw new Error('A PharmaSupplyChain contract instance is required');
    this.contract = contract;
  }

  /** Creates a raw-material batch and returns its on-chain ID and receipt. */
  async createMedicineBatch({ drugName, metadataURI = '', signer }) {
    if (!signer) throw new Error('A stakeholder signer is required');
    const tx = await this.contract.connect(signer).addRawMaterial(drugName, metadataURI);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => { try { return this.contract.interface.parseLog(log); } catch (_) { return null; } })
      .find((log) => log && log.name === 'RawMaterialAdded');
    return { batchId: event.args.batchId.toString(), txHash: receipt.hash, receipt };
  }

  /**
   * Checks the ECDSA handoff proof, then performs the permitted lifecycle call.
   * `signatureRecord.payload` must be made with cryptoService.createTransferPayload.
   */
  async updateBatchStage({ batchId, stage, recipient, signer, signatureRecord }) {
    if (!signer) throw new Error('A stakeholder signer is required');
    const sender = await signer.getAddress();
    if (!signatureRecord || !signatureRecord.signature || !signatureRecord.payload) {
      throw new Error('A signed transfer payload is required');
    }
    const signatureCheck = cryptoService.verifyTransferSignature(
      signatureRecord.signature, signatureRecord.payload, sender
    );
    if (!signatureCheck.valid) throw new Error('Transfer signature is invalid or belongs to another stakeholder');
    if (String(signatureRecord.payload.batchId) !== String(batchId) || signatureRecord.payload.stage !== stage) {
      throw new Error('Signed payload does not match the requested batch or stage');
    }

    const writeContract = this.contract.connect(signer);
    let tx;
    if (stage === 'Shipped') tx = await writeContract.manufactureBatch(batchId);
    else if (stage === 'InTransit') tx = await writeContract.transferToDistributor(batchId, recipient);
    else if (stage === 'Delivered') tx = await writeContract.transferToPharmacy(batchId, recipient);
    else if (stage === 'Dispensed') tx = await writeContract.dispenseToPatient(batchId, recipient);
    else throw new Error(`Unsupported target stage: ${stage}`);
    const receipt = await tx.wait();
    return { batchId: String(batchId), stage, txHash: receipt.hash, receipt, signature: signatureCheck };
  }

  /** Returns the immutable custody timeline in a frontend-friendly form. */
  async getBatchProvenance(batchId) {
    const [batch, history] = await Promise.all([
      this.contract.getBatch(batchId),
      this.contract.getTransferHistory(batchId),
    ]);
    return {
      batch: {
        ...serialise(batch),
        stageName: STAGES[Number(batch.stage)],
        isAuthentic: !batch.isCounterfeit,
      },
      timeline: history.map((record, index) => ({
        sequence: index + 1,
        ...serialise(record),
        fromRoleName: ROLES[Number(record.fromRole)],
        toRoleName: ROLES[Number(record.toRole)],
        stageName: STAGES[Number(record.stage)],
      })),
    };
  }

  /**
   * Validates supplied off-chain ECDSA audit records and the authoritative
   * on-chain counterfeit flag. A missing or invalid signature makes the result
   * unverified even when the blockchain record itself is valid.
   */
  async verifyBatchAuthenticity(batchId, signedTransitions = []) {
    const provenance = await this.getBatchProvenance(batchId);
    const signatureChecks = signedTransitions.map((record) => {
      const expectedAddress = record.expectedAddress || record.payload?.fromAddress;
      const result = cryptoService.verifyTransferSignature(record.signature, record.payload, expectedAddress);
      return { action: record.action || 'HANDOFF', valid: result.valid, recoveredAddress: result.recoveredAddress, expectedAddress: result.expectedAddress, payloadHash: result.payloadHash };
    });
    const signaturesValid = signedTransitions.length > 0 && signatureChecks.every((check) => check.valid);
    return {
      batchId: String(batchId),
      authentic: provenance.batch.isAuthentic && signaturesValid,
      blockchainValid: provenance.batch.isAuthentic,
      signaturesValid,
      signatureChecks,
      provenance,
    };
  }
}

function fromEnvironment() {
  const address = process.env.SUPPLY_CHAIN_CONTRACT_ADDRESS;
  if (!address) throw new Error('SUPPLY_CHAIN_CONTRACT_ADDRESS is not configured');
  const artifact = require('../../artifacts/contracts/PharmaSupplyChain.sol/PharmaSupplyChain.json');
  const provider = new ethers.JsonRpcProvider(process.env.SUPPLY_CHAIN_RPC_URL || 'http://127.0.0.1:8545');
  return new SupplyChainService(new ethers.Contract(address, artifact.abi, provider));
}

module.exports = { SupplyChainService, fromEnvironment, STAGES, ROLES };
