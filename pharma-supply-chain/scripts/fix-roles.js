const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("PharmaSupplyChainCompatible", "0x9Da75748d07A394465E56fF624c6aCD1a24FF42e");
  const overrides = { gasLimit: 500000 };
  
  await contract.registerStakeholder("0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510", 2, "0x", overrides).then(tx => tx.wait());
  await contract.registerStakeholder("0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5", 3, "0x", overrides).then(tx => tx.wait());
  await contract.registerStakeholder("0xA514337cbcc4149952220A23487eF961E748Ce8C", 4, "0x", overrides).then(tx => tx.wait());
  await contract.registerStakeholder("0x02d61482CAB7847e8E46D68C58e2601a8c2D589c", 5, "0x", overrides).then(tx => tx.wait());
  console.log("Done");
}
main().catch(console.error);
