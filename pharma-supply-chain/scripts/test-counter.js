const hre = require("hardhat");
async function main() {
  const contractAddress = "0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c";
  const Factory = await hre.ethers.getContractFactory("PharmaSupplyChainCompatible");
  const contract = Factory.attach(contractAddress);
  const tc = await contract.tokenCounter();
  console.log("TokenCounter:", tc);
}
main().catch(console.error);
