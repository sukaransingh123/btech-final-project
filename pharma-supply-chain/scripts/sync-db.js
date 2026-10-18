const hre = require("hardhat");
const mongoose = require("mongoose");
const Batch = require("../backend/models/Batch");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", "env") });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/pharma-supply-chain");
  console.log("Connected to DB.");

  const contractAddress = "0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c";
  const Factory = await hre.ethers.getContractFactory("PharmaSupplyChainCompatible");
  const contract = Factory.attach(contractAddress);

  const batches = await Batch.find({});
  console.log(`Found ${batches.length} batches in DB.`);

  for (const batch of batches) {
    if (batch.tokenId) {
      try {
        const owner = await contract.ownerOf(batch.tokenId);
        const role = await contract.getRole(owner);
        const roleNum = Number(role);
        
        let roleName = "Unknown";
        if (roleNum === 1) roleName = "Manufacturer";
        else if (roleNum === 2) roleName = "Distributor";
        else if (roleNum === 3) roleName = "Retailer";
        else if (roleNum === 4) roleName = "Pharmacy";
        
        if (batch.currentOwner.toLowerCase() !== owner.toLowerCase()) {
          console.log(`Updating batch ${batch.batchID} (Token ${batch.tokenId}): ${batch.currentOwner} -> ${owner}`);
          batch.currentOwner = owner.toLowerCase();
          batch.currentRole = roleName;
          await batch.save();
        }
      } catch (e) {
        console.log(`Could not check token ${batch.tokenId}:`, e.message);
      }
    }
  }
  
  console.log("Sync complete.");
  process.exit(0);
}
main().catch(console.error);
