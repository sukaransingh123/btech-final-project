const hre = require("hardhat");
async function main() {
  const contractAddress = "0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c";
  const Factory = await hre.ethers.getContractFactory("PharmaSupplyChainCompatible");
  const contract = Factory.attach(contractAddress);
  
  const addrParam = "0xa514337cbcc4149952220a23487ef961e748ce8c";
  const role = await contract.getRole(addrParam);
  console.log(`Role of ${addrParam}:`, role);
  
  const owner = await contract.ownerOf(1);
  console.log(`Owner of Token 1:`, owner);
  
  const distAddr = "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5";
  const scanned = await contract.scannedByRole(1, 2); // 2 = Distributor
  console.log(`Scanned by Distributor?`, scanned);
}
main().catch(console.error);
