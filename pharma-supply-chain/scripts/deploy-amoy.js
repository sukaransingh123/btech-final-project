const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers, network } = hre;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   PharmaSupplyChain — Amoy Testnet Deployment    ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\n🌐 Network: ${network.name}`);

  // We only use the owner wallet to deploy
  const [owner] = await ethers.getSigners();
  console.log(`\n👨‍💻 Deployer Address: ${owner.address}`);

  // Get balance to ensure we have enough POL
  const balance = await ethers.provider.getBalance(owner.address);
  console.log(`💰 Deployer Balance: ${ethers.formatEther(balance)} POL`);

  if (balance === 0n) {
    throw new Error("Deployer account has 0 POL! Please get some from the Polygon faucet.");
  }

  // ── Deploy ───────────────────────────────────────────────────────
  console.log("\n🚀 Deploying PharmaSupplyChain to Amoy Testnet...");
  const Factory = await ethers.getContractFactory("PharmaSupplyChainCompatible", owner);
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`✅ PharmaSupplyChain deployed to: ${contractAddress}`);

  // ── Target Addresses provided by User ────────────────────────────
  const TARGET_MANUFACTURER = "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510";
  const TARGET_DISTRIBUTOR = "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5";
  const TARGET_RETAILER = "0xA514337cbcc4149952220A23487eF961E748Ce8C"; // Note: mapped to Distributor or Pharmacy in our 5-stage flow
  const TARGET_PHARMACY = "0x02d61482CAB7847e8E46D68C58e2601a8c2D589c";

  // Role Enum values from PharmaSupplyChainCompatible.sol:
  // Manufacturer=1, Distributor=2, Retailer=3, Pharmacy=4
  
  console.log("\n🔑 Assigning roles on-chain...");

  const roleAssignments = [
    { address: TARGET_MANUFACTURER, roleEnum: 1, roleName: "Manufacturer" },
    { address: TARGET_DISTRIBUTOR,  roleEnum: 2, roleName: "Distributor" },
    { address: TARGET_RETAILER,     roleEnum: 3, roleName: "Retailer" },
    { address: TARGET_PHARMACY,     roleEnum: 4, roleName: "Pharmacy" },
  ];

  for (const { address, roleEnum, roleName } of roleAssignments) {
    console.log(`   Assigning ${roleName} to ${address}...`);
    // PharmaNFT uses setRole instead of assignRole
    const tx = await contract.setRole(address, roleEnum);
    await tx.wait(1); // Wait for 1 confirmation on Amoy
    console.log(`   ✓ Success! Tx: ${tx.hash}`);
  }

  // ── Save deployment artefacts ────────────────────────────────────
  console.log("\n💾 Saving deployment artefacts...");

  const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

  fs.writeFileSync(
    path.join(frontendDir, "contract-address.json"),
    JSON.stringify({ address: contractAddress, contractName: "PharmaSupplyChainCompatible" }, null, 2)
  );
  
  // Update .env with new contract address
  const envPath = path.join(__dirname, "..", "env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/CONTRACT_ADDRESS=0x[a-fA-F0-9]{40}/, `CONTRACT_ADDRESS=${contractAddress}`);
    fs.writeFileSync(envPath, envContent);
    console.log(`   ✓ Updated CONTRACT_ADDRESS in project /env file`);
  }

  console.log("\n✅ Amoy Deployment & Role Assignment Complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
