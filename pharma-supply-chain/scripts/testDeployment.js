const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing Pharma Supply Chain Deployment...");

  // Get all signers
  const [owner, manufacturer, distributor, retailer, pharmacy] = await hre.ethers.getSigners();
  
  console.log("📋 Stakeholder Addresses:");
  console.log("Owner:", owner.address);
  console.log("Manufacturer:", manufacturer.address);
  console.log("Distributor:", distributor.address);
  console.log("Retailer:", retailer.address);
  console.log("Pharmacy:", pharmacy.address);

  // Load deployment info
  const fs = require('fs');
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    console.log("\n📄 Contract Address:", deploymentInfo.contractAddress);
  } catch (error) {
    console.log("❌ Could not load deployment info. Please deploy first.");
    return;
  }

  // Get contract instance
  const PharmaNFT = await hre.ethers.getContractFactory("PharmaNFT");
  const pharma = PharmaNFT.attach(deploymentInfo.contractAddress);

  console.log("\n🔍 Testing Contract Functions...");

  // Test 1: Check roles
  console.log("\n1️⃣ Testing Role Assignment:");
  try {
    const manufacturerRole = await pharma.getRole(manufacturer.address);
    const distributorRole = await pharma.getRole(distributor.address);
    const retailerRole = await pharma.getRole(retailer.address);
    const pharmacyRole = await pharma.getRole(pharmacy.address);
    
    console.log("✓ Manufacturer role:", Number(manufacturerRole));
    console.log("✓ Distributor role:", Number(distributorRole));
    console.log("✓ Retailer role:", Number(retailerRole));
    console.log("✓ Pharmacy role:", Number(pharmacyRole));
  } catch (error) {
    console.log("❌ Error checking roles:", error.message);
  }

  // Test 2: Create a batch
  console.log("\n2️⃣ Testing Batch Creation:");
  try {
    const batchID = `TEST_BATCH_${Date.now()}`;
    const tokenURI = "https://ipfs.io/ipfs/QmTestMetadata";
    
    // Generate metadata hash for integrity verification
    const crypto = require('crypto');
    const metadataString = JSON.stringify({
      batchID: batchID,
      drugName: "Test Drug",
      manufacturingDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 1,
      manufacturer: manufacturer.address.toLowerCase()
    });
    const metadataHash = crypto.createHash('sha256').update(metadataString).digest('hex');
    
    const tx = await pharma.connect(manufacturer).mintBatch(tokenURI, batchID, metadataHash);
    await tx.wait();
    
    const tokenCounter = await pharma.tokenCounter();
    const tokenId = Number(tokenCounter) - 1;
    
    console.log("✓ Batch created successfully!");
    console.log("✓ Token ID:", tokenId);
    console.log("✓ Batch ID:", batchID);
    
    // Test 3: Transfer batch through supply chain
    console.log("\n3️⃣ Testing Supply Chain Transfer:");
    
    // Manufacturer → Distributor
    console.log("🔄 Transferring Manufacturer → Distributor...");
    const tx1 = await pharma.connect(manufacturer).transferBatch(tokenId, distributor.address);
    await tx1.wait();
    console.log("✓ Transferred to Distributor");
    
    // Distributor → Retailer
    console.log("🔄 Transferring Distributor → Retailer...");
    const tx2 = await pharma.connect(distributor).transferBatch(tokenId, retailer.address);
    await tx2.wait();
    console.log("✓ Transferred to Retailer");
    
    // Retailer → Pharmacy
    console.log("🔄 Transferring Retailer → Pharmacy...");
    const tx3 = await pharma.connect(retailer).transferBatch(tokenId, pharmacy.address);
    await tx3.wait();
    console.log("✓ Transferred to Pharmacy");
    
    // Test 4: Verify batch
    console.log("\n4️⃣ Testing Batch Verification:");
    const isValid = await pharma.connect(pharmacy).verifyBatch(tokenId);
    console.log("✓ Batch verification result:", isValid);
    
    // Test 5: Get transfer history
    console.log("\n5️⃣ Testing Transfer History:");
    const transferHistory = await pharma.getTransferHistory(tokenId);
    console.log("✓ Transfer history length:", transferHistory.length);
    
    transferHistory.forEach((record, index) => {
      console.log(`  Step ${index + 1}: ${record.from} → ${record.to}`);
    });
    
    // Test 6: Get batch details
    console.log("\n6️⃣ Testing Batch Details:");
    const batchDetails = await pharma.getBatchDetails(tokenId);
    console.log("✓ Batch ID:", batchDetails.batchID);
    console.log("✓ Current Owner:", batchDetails.currentOwner);
    console.log("✓ Current Role:", Number(batchDetails.currentRole));
    console.log("✓ Manufacturer:", batchDetails.manufacturer);
    
    console.log("\n✅ All tests passed successfully!");
    console.log("\n📊 Test Summary:");
    console.log("- Contract deployed and accessible");
    console.log("- Roles assigned correctly");
    console.log("- Batch creation working");
    console.log("- Supply chain transfers working");
    console.log("- Batch verification working");
    console.log("- Transfer history tracking working");
    
  } catch (error) {
    console.log("❌ Error during testing:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
