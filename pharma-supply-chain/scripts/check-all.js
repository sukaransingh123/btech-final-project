const hre = require("hardhat");
async function main() {
  const accounts = [
    "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510", // Manufacturer
    "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5", // Distributor
    "0xA514D62C92a2a4bE34F40608CE03fCcd8C188Ce8", // Retailer
    "0x02d6451e08922df4fDeD79DEEEbDF0B6661C589c"  // Pharmacy
  ];
  
  const provider = hre.ethers.provider;
  
  for (const acc of accounts) {
    const bal = await provider.getBalance(acc);
    console.log(`${acc}: ${hre.ethers.formatEther(bal)} POL`);
  }
}
main().catch(console.error);
