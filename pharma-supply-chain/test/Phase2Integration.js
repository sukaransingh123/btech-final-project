const { expect } = require('chai');
const { ethers } = require('hardhat');
const { SupplyChainService } = require('../backend/services/supplyChainService');
const cryptoService = require('../backend/services/cryptoService');

describe('Phase 2 — cryptographic Web3 bridge', function () {
  let contract, bridge, supplier, manufacturer, distributor, pharmacy, consumer;
  const signatures = [];

  async function signedHandoff(signer, params) {
    // Hardhat exposes deterministic test keys only in the local test network.
    const wallet = ethers.Wallet.createRandom();
    // Use the signer itself for EIP-191 signing; this is the same method MetaMask uses.
    const payload = cryptoService.createTransferPayload(params);
    const payloadHash = cryptoService.hashPayload(payload);
    const signature = await signer.signMessage(ethers.getBytes(payloadHash));
    return { signature, payload: params, expectedAddress: await signer.getAddress() };
  }

  beforeEach(async function () {
    [, supplier, manufacturer, distributor, pharmacy, consumer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('PharmaSupplyChain');
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    await contract.assignRoleBatch(
      [supplier.address, manufacturer.address, distributor.address, pharmacy.address],
      [1, 2, 3, 4]
    );
    bridge = new SupplyChainService(contract);
    signatures.length = 0;
  });

  it('signs, verifies and completes the Supplier → Consumer handoff', async function () {
    const created = await bridge.createMedicineBatch({
      drugName: 'Paracetamol 500mg', metadataURI: 'ipfs://quality-certificate', signer: supplier,
    });
    const batchId = created.batchId;

    const manufacture = await signedHandoff(manufacturer, {
      batchId, drugName: 'Paracetamol 500mg', fromAddress: manufacturer.address, toAddress: manufacturer.address,
      fromRole: 'Manufacturer', toRole: 'Manufacturer', stage: 'Shipped', timestamp: 1700000001,
    });
    await bridge.updateBatchStage({ batchId, stage: 'Shipped', signer: manufacturer, signatureRecord: manufacture });
    signatures.push({ ...manufacture, action: 'MANUFACTURE' });

    const distribute = await signedHandoff(manufacturer, {
      batchId, drugName: 'Paracetamol 500mg', fromAddress: manufacturer.address, toAddress: distributor.address,
      fromRole: 'Manufacturer', toRole: 'Distributor', stage: 'InTransit', timestamp: 1700000002,
    });
    await bridge.updateBatchStage({ batchId, stage: 'InTransit', recipient: distributor.address, signer: manufacturer, signatureRecord: distribute });
    signatures.push({ ...distribute, action: 'TRANSFER_TO_DISTRIBUTOR' });

    const deliver = await signedHandoff(distributor, {
      batchId, drugName: 'Paracetamol 500mg', fromAddress: distributor.address, toAddress: pharmacy.address,
      fromRole: 'Distributor', toRole: 'Pharmacy', stage: 'Delivered', timestamp: 1700000003,
    });
    await bridge.updateBatchStage({ batchId, stage: 'Delivered', recipient: pharmacy.address, signer: distributor, signatureRecord: deliver });
    signatures.push({ ...deliver, action: 'TRANSFER_TO_PHARMACY' });

    const dispense = await signedHandoff(pharmacy, {
      batchId, drugName: 'Paracetamol 500mg', fromAddress: pharmacy.address, toAddress: consumer.address,
      fromRole: 'Pharmacy', toRole: 'Consumer', stage: 'Dispensed', timestamp: 1700000004,
    });
    await bridge.updateBatchStage({ batchId, stage: 'Dispensed', recipient: consumer.address, signer: pharmacy, signatureRecord: dispense });
    signatures.push({ ...dispense, action: 'DISPENSE' });

    const provenance = await bridge.getBatchProvenance(batchId);
    expect(provenance.batch.stageName).to.equal('Dispensed');
    expect(provenance.timeline).to.have.length(5);
    expect(provenance.timeline.map((item) => item.stageName)).to.deep.equal(['Produced', 'Shipped', 'InTransit', 'Delivered', 'Dispensed']);

    const authenticity = await bridge.verifyBatchAuthenticity(batchId, signatures);
    expect(authenticity.authentic).to.equal(true);
    expect(authenticity.signaturesValid).to.equal(true);
  });

  it('rejects a transfer when its ECDSA proof belongs to another wallet', async function () {
    const { batchId } = await bridge.createMedicineBatch({ drugName: 'Ibuprofen', signer: supplier });
    const forged = await signedHandoff(distributor, {
      batchId, drugName: 'Ibuprofen', fromAddress: manufacturer.address, toAddress: manufacturer.address,
      fromRole: 'Manufacturer', toRole: 'Manufacturer', stage: 'Shipped', timestamp: 1700000010,
    });
    await expect(bridge.updateBatchStage({ batchId, stage: 'Shipped', signer: manufacturer, signatureRecord: forged }))
      .to.be.rejectedWith('Transfer signature is invalid');
  });
});
