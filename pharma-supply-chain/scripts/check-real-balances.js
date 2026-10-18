const hre = require("hardhat");
async function main() {
  const accounts = [
    "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510", // Manufacturer
    "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5", // Distributor
    "0xA514337cbcc4149952220A23487eF961E748Ce8C", // Retailer
    "0x02d61482CAB7847e8E46D68C58e2601a8c2D589c"  // Pharmacy
  ];
  const provider = hre.ethers.provider;
  for (const acc of accounts) {
    const bal = await provider.getBalance(acc);
    console.log(`${acc}: ${hre.ethers.formatEther(bal)} POL`);
  }
}
main().catch(console.error);
