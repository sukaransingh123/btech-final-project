const hre = require("hardhat");
async function main() {
  const contractAddress = "0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c";
  const Factory = await hre.ethers.getContractFactory("PharmaSupplyChainCompatible");
  const contract = Factory.attach(contractAddress);
  
  const mfrAddress = "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510";
  const distAddress = "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5";
  
  const mfrRole = await contract.getRole(mfrAddress);
  const distRole = await contract.getRole(distAddress);
  
  console.log("Mfr Role:", mfrRole);
  console.log("Dist Role:", distRole);
  
  const owner = await contract.ownerOf(1);
  console.log("Owner of Token 1:", owner);
  
  const scanned = await contract.scannedByRole(1, mfrRole);
  console.log("Scanned by Mfr?", scanned);
}
main().catch(console.error);
