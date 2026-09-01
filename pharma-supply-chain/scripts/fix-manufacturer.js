const hre = require("hardhat");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, '..', 'env') });

async function main() {
  const { ethers } = hre;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  console.log(`Connecting to PharmaSupplyChainCompatible at: ${contractAddress}`);
  
  const [owner] = await ethers.getSigners();
  console.log(`Owner address: ${owner.address}`);
  
  const contract = await ethers.getContractAt("PharmaSupplyChainCompatible", contractAddress, owner);
  
  const TARGET_MANUFACTURER = "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510";
  
  console.log(`Registering ${TARGET_MANUFACTURER} as Manufacturer...`);
  const tx = await contract.registerManufacturer(TARGET_MANUFACTURER);
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait(1);
  
  console.log("✅ Successfully registered the Manufacturer!");
  
  const isMfg = await contract.isManufacturer(TARGET_MANUFACTURER);
  console.log(`isManufacturer(${TARGET_MANUFACTURER}) = ${isMfg}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
