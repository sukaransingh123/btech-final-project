const { ethers } = require('hardhat');
const path = require('path');
const dotenv = require('dotenv');
const { 
  createMedicineBatch, 
  updateBatchStage, 
  getBatchProvenance, 
  verifyBatchAuthenticity 
} = require('../backend/services/blockchainService');

dotenv.config({ path: path.join(__dirname, '..', 'env') });

async function runSimulation() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Phase 2: Complete Batch Handoff Simulation     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  try {
    // 1. Get local signers
    const signers = await ethers.getSigners();
    const [supplier, manufacturer, distributor, retailer, pharmacy, consumer] = signers;

    // 2. Deploy a fresh contract locally for the simulation
    console.log("⚙️ Deploying fresh contract for simulation...");
    const Factory = await ethers.getContractFactory("PharmaSupplyChain", supplier);
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    // 3. Assign roles
    console.log("🔑 Assigning Roles...");
    await contract.assignRole(supplier.address, 1);     // Supplier
    await contract.assignRole(manufacturer.address, 2); // Manufacturer
    await contract.assignRole(distributor.address, 3);  // Distributor
    await contract.assignRole(retailer.address, 4);     // Retailer
    await contract.assignRole(pharmacy.address, 5);     // Pharmacy

    // SIMULATION STEPS
    console.log("\n[1/5] Supplier adding raw material...");
    let tx = await contract.connect(supplier).addRawMaterial("Amoxicillin 500mg", "ipfs://Qm...");
    await tx.wait();
    const batchId = 0; // First batch is always 0
    console.log(`✅ Batch Created! ID: ${batchId}`);

    console.log("\n[2/5] Manufacturer processing batch...");
    tx = await contract.connect(manufacturer).manufactureBatch(batchId);
    await tx.wait();
    console.log(`✅ Manufactured!`);

    console.log(`\n[3/5] Transferring to Distributor (${distributor.address})...`);
    tx = await contract.connect(manufacturer).transferToDistributor(batchId, distributor.address);
    await tx.wait();
    console.log(`✅ Transferred to Distributor!`);

    console.log(`\n[4/5] Transferring to Retailer (${retailer.address})...`);
    tx = await contract.connect(distributor).transferToRetailer(batchId, retailer.address);
    await tx.wait();
    console.log(`✅ Transferred to Retailer!`);

    console.log(`\n[5/5] Transferring to Pharmacy (${pharmacy.address})...`);
    tx = await contract.connect(retailer).transferToPharmacy(batchId, pharmacy.address);
    await tx.wait();
    console.log(`✅ Transferred to Pharmacy!`);
    
    // Verify Provenance
    console.log("\n🔍 Fetching Batch Provenance...");
    const provenance = await contract.getTransferHistory(batchId);
    console.log(`   Found ${provenance.length} lifecycle events.`);
    provenance.forEach((p, i) => {
      console.log(`   Step ${i+1}: Role ${p.fromRole} -> Role ${p.toRole} (Stage: ${p.stage})`);
    });

    // Verify Authenticity
    console.log("\n🔐 Verifying Cryptographic Authenticity...");
    const auth = await contract.verifyBatch.staticCall(batchId);
    console.log(`   Is Authentic: ${auth[0]}`);
    console.log(`   Current Stage: ${auth[1]}`);
    console.log(`   Digital Signature Hash Valid: ${auth[3] !== ethers.ZeroHash}`);

    console.log("\n✅ SIMULATION COMPLETED WITH ZERO FAILURES!");

  } catch (err) {
    console.error("\n❌ SIMULATION FAILED:", err.message);
  }
}

runSimulation();
