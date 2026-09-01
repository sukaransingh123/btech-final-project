/**
 * deploy.js — Unified deployment script for PharmaSupplyChain
 *
 * Usage:
 *   Local:  npx hardhat run scripts/deploy.js --network localhost
 *   Amoy:   npx hardhat run scripts/deploy.js --network amoy
 */

const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const { ethers, network } = hre;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   PharmaSupplyChain — Deployment Script          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\n🌐 Network: ${network.name}`);

  // ── Signers ─────────────────────────────────────────────────────
  const signers = await ethers.getSigners();
  const [owner, supplier, manufacturer, distributor, pharmacy] = signers;

  console.log("\n👥 Stakeholder Addresses:");
  console.log("   Owner        :", owner.address);
  console.log("   Supplier     :", supplier?.address     ?? "not configured");
  console.log("   Manufacturer :", manufacturer?.address ?? "not configured");
  console.log("   Distributor  :", distributor?.address  ?? "not configured");
  console.log("   Pharmacy     :", pharmacy?.address     ?? "not configured");

  // ── Deploy ───────────────────────────────────────────────────────
  console.log("\n🚀 Deploying PharmaSupplyChain...");
  const Factory  = await ethers.getContractFactory("PharmaSupplyChainCompatible", owner);
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ PharmaSupplyChain deployed to:", contractAddress);

  // ── Verify basic state ───────────────────────────────────────────
  // const totalBatches = await contract.getTotalBatches();
  // console.log("   Initial batch counter:", totalBatches.toString());

  // ── Assign Roles ─────────────────────────────────────────────────
  console.log("\n🔑 Assigning roles...");

  const roleAssignments = [
    { address: "0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510", roleEnum: 1, roleName: "Manufacturer" },
    { address: "0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5", roleEnum: 2, roleName: "Distributor"  },
    { address: "0xA514337cbcc4149952220A23487eF961E748Ce8C", roleEnum: 3, roleName: "Retailer"     },
    { address: "0x02d61482CAB7847e8E46D68C58e2601a8c2D589c", roleEnum: 4, roleName: "Pharmacy"     },
  ];

  for (const { address, roleEnum, roleName } of roleAssignments) {
    const tx = await contract.connect(owner).registerStakeholder(address, roleEnum, "0x");
    await tx.wait();
    console.log(`   ✓ ${roleName.padEnd(14)} → ${address}`);
  }

  // ── Verify roles on-chain ────────────────────────────────────────
  console.log("\n🔍 Verifying roles on-chain...");
  for (const { address, roleEnum, roleName } of roleAssignments) {
    const onChainRole = await contract.getRole(address);
    const ok = Number(onChainRole) === roleEnum;
    console.log(`   ${ok ? "✓" : "✗"} ${roleName.padEnd(14)} role = ${onChainRole} ${ok ? "" : "(MISMATCH!)"}`);
  }

  // ── Save deployment artefacts ────────────────────────────────────
  console.log("\n💾 Saving deployment artefacts...");

  // 1. Root deployment-info.json
  const deploymentInfo = {
    contractName:    "PharmaSupplyChain",
    contractAddress,
    deployer:        owner.address,
    network:         network.name,
    chainId:         (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp:       new Date().toISOString(),
    stakeholders: {
      owner:        owner.address,
      supplier:     supplier?.address     ?? null,
      manufacturer: manufacturer?.address ?? null,
      distributor:  distributor?.address  ?? null,
      pharmacy:     pharmacy?.address     ?? null,
    }
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "deployment-info.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("   ✓ deployment-info.json updated");

  // 2. Frontend contract files
  try {
    const artifactPath = path.join(
      __dirname, "..", "artifacts", "contracts",
      "PharmaSupplyChain.sol", "PharmaSupplyChain.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");
    if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

    fs.writeFileSync(
      path.join(frontendDir, "PharmaSupplyChain.json"),
      JSON.stringify(artifact, null, 2)
    );
    fs.writeFileSync(
      path.join(frontendDir, "contract-address.json"),
      JSON.stringify({ address: contractAddress, contractName: "PharmaSupplyChain" }, null, 2)
    );
    console.log("   ✓ frontend/src/contracts/ updated with new ABI + address");
  } catch (err) {
    console.warn("   ⚠ Could not write frontend files:", err.message);
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Deployment Summary                             ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║   Contract  : PharmaSupplyChain                  ║`);
  console.log(`║   Address   : ${contractAddress}  ║`);
  console.log(`║   Network   : ${network.name.padEnd(35)}║`);
  console.log(`║   Deployer  : ${owner.address}  ║`);
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
