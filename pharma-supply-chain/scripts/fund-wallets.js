const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  
  const [owner] = await ethers.getSigners();
  console.log(`Sender (Owner) address: ${owner.address}`);
  
  const balance = await ethers.provider.getBalance(owner.address);
  console.log(`Owner balance: ${ethers.formatEther(balance)} POL`);
  
  const targets = [
    "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510", // Manufacturer
    "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5", // Distributor
    "0xA514337cbcc4149952220A23487eF961E748Ce8C", // Retailer
    "0x02d61482CAB7847e8E46D68C58e2601a8c2D589c"  // Pharmacy
  ];
  
  const amountToSend = ethers.parseEther("0.5"); // 0.5 POL each
  
  for (const target of targets) {
    console.log(`Sending 0.5 POL to ${target}...`);
    const tx = await owner.sendTransaction({
      to: target,
      value: amountToSend
    });
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait(1);
    console.log(`✅ Success for ${target}`);
  }
  
  console.log("All testnet wallets funded successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
