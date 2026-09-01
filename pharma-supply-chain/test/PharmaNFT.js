const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaNFT", function () {
  let pharmaNFT;
  let owner;
  let manufacturer;
  let distributor;
  let retailer;
  let pharmacy;
  let otherAccount;

  // Reusable mint helper — keeps tests DRY
  const MOCK_URI  = "https://ipfs.io/ipfs/QmExampleMetadata";
  const MOCK_HASH = "0xabc123def456abc123def456abc123def456abc123def456abc123def456abcd";

  async function mintBatch(signer, batchID) {
    return pharmaNFT.connect(signer).mintBatch(MOCK_URI, batchID, MOCK_HASH);
  }

  beforeEach(async function () {
    [owner, manufacturer, distributor, retailer, pharmacy, otherAccount] =
      await ethers.getSigners();

    const PharmaNFT = await ethers.getContractFactory("PharmaNFT");
    pharmaNFT = await PharmaNFT.deploy();
    await pharmaNFT.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await pharmaNFT.owner()).to.equal(owner.address);
    });

    it("Should initialize token counter to 1", async function () {
      expect(await pharmaNFT.tokenCounter()).to.equal(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("Role Management", function () {
    it("Should allow owner to register manufacturer", async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
      expect(await pharmaNFT.isManufacturer(manufacturer.address)).to.be.true;
      expect(await pharmaNFT.getRole(manufacturer.address)).to.equal(1);
    });

    it("Should allow owner to set roles", async function () {
      await pharmaNFT.setRole(distributor.address, 2);
      await pharmaNFT.setRole(retailer.address, 3);
      await pharmaNFT.setRole(pharmacy.address, 4);

      expect(await pharmaNFT.getRole(distributor.address)).to.equal(2);
      expect(await pharmaNFT.getRole(retailer.address)).to.equal(3);
      expect(await pharmaNFT.getRole(pharmacy.address)).to.equal(4);
    });

    it("Should not allow non-owner to register manufacturer", async function () {
      await expect(
        pharmaNFT.connect(manufacturer).registerManufacturer(manufacturer.address)
      ).to.be.revertedWithCustomError(pharmaNFT, "OwnableUnauthorizedAccount");
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("Batch Minting", function () {
    beforeEach(async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
    });

    it("Should allow registered manufacturer to mint batch", async function () {
      await expect(mintBatch(manufacturer, "BATCH001"))
        .to.emit(pharmaNFT, "BatchMinted")
        .withArgs(1, manufacturer.address, "BATCH001");

      expect(await pharmaNFT.ownerOf(1)).to.equal(manufacturer.address);

      const batchDetails = await pharmaNFT.getBatchDetails(1);
      expect(batchDetails.batchID).to.equal("BATCH001");
      expect(batchDetails.currentOwner).to.equal(manufacturer.address);
      expect(batchDetails.currentRole).to.equal(1); // Manufacturer
    });

    it("Should not allow non-manufacturer to mint batch", async function () {
      await pharmaNFT.setRole(distributor.address, 2);
      await expect(
        mintBatch(distributor, "BATCH001")
      ).to.be.revertedWith("Only manufacturers can perform this action");
    });

    it("Should increment token counter after minting", async function () {
      await mintBatch(manufacturer, "BATCH001");
      expect(await pharmaNFT.tokenCounter()).to.equal(2);
    });

    it("Should store metadataHash on-chain", async function () {
      await mintBatch(manufacturer, "BATCH001");
      const details = await pharmaNFT.getBatchDetails(1);
      expect(details.metadataHash).to.equal(MOCK_HASH);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("Batch Transfer", function () {
    beforeEach(async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
      await pharmaNFT.setRole(distributor.address, 2);
      await pharmaNFT.setRole(retailer.address, 3);
      await pharmaNFT.setRole(pharmacy.address, 4);

      // Manufacturer mints; Manufacturer does NOT need a prior scan to transfer
      await mintBatch(manufacturer, "BATCH001");
    });

    it("Should allow valid transfer: Manufacturer → Distributor", async function () {
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);

      expect(await pharmaNFT.ownerOf(1)).to.equal(distributor.address);
      const d = await pharmaNFT.getBatchDetails(1);
      expect(d.currentOwner).to.equal(distributor.address);
      expect(d.currentRole).to.equal(2); // Distributor
    });

    it("Should allow valid transfer: Distributor → Retailer (after scan)", async function () {
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);

      // Contract requires Distributor to recordScan before transferring forward
      await pharmaNFT.connect(distributor).recordScan(1);
      await pharmaNFT.connect(distributor).transferBatch(1, retailer.address);

      expect(await pharmaNFT.ownerOf(1)).to.equal(retailer.address);
    });

    it("Should allow full chain: Manufacturer → Distributor → Retailer", async function () {
      // Contract supports: Manufacturer→Distributor, Distributor→Retailer (max chain)
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);

      await pharmaNFT.connect(distributor).recordScan(1);
      await pharmaNFT.connect(distributor).transferBatch(1, retailer.address);

      expect(await pharmaNFT.ownerOf(1)).to.equal(retailer.address);
      const d = await pharmaNFT.getBatchDetails(1);
      expect(d.currentRole).to.equal(3); // Retailer
    });

    it("Should allow Manufacturer to skip directly to Retailer", async function () {
      // Contract explicitly allows Manufacturer → Retailer (direct bypass of Distributor)
      await pharmaNFT.connect(manufacturer).transferBatch(1, retailer.address);
      expect(await pharmaNFT.ownerOf(1)).to.equal(retailer.address);
      const d = await pharmaNFT.getBatchDetails(1);
      expect(d.currentRole).to.equal(3); // Retailer
    });

    it("Should not allow transfer to address without role", async function () {
      await expect(
        pharmaNFT.connect(manufacturer).transferBatch(1, otherAccount.address)
      ).to.be.revertedWith("Invalid transfer");
    });

    it("Should not allow Distributor to transfer without scanning first", async function () {
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);
      await expect(
        pharmaNFT.connect(distributor).transferBatch(1, retailer.address)
      ).to.be.revertedWith("Scan required before transfer");
    });

    it("Should record transfer history", async function () {
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);

      const history = await pharmaNFT.getTransferHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[0].fromRole).to.equal(1); // Manufacturer
      expect(history[0].toRole).to.equal(2);   // Distributor
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("Batch Verification", function () {
    beforeEach(async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
      await pharmaNFT.setRole(distributor.address, 2);
      await pharmaNFT.setRole(retailer.address, 3);
      await pharmaNFT.setRole(pharmacy.address, 4);

      await mintBatch(manufacturer, "BATCH001");
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);
    });

    it("Should allow distributor to verify batch", async function () {
      const tx = await pharmaNFT.connect(distributor).verifyBatch(1);
      await tx.wait();
      expect(tx).to.not.be.null;
    });

    it("Should allow retailer to verify batch", async function () {
      await pharmaNFT.connect(distributor).recordScan(1);
      await pharmaNFT.connect(distributor).transferBatch(1, retailer.address);
      const tx = await pharmaNFT.connect(retailer).verifyBatch(1);
      await tx.wait();
      expect(tx).to.not.be.null;
    });

    it("Should allow retailer to verify batch after full chain transfer", async function () {
      // Full chain: Manufacturer → Distributor → Retailer (Retailer→Pharmacy not yet in contract)
      await pharmaNFT.connect(distributor).recordScan(1);
      await pharmaNFT.connect(distributor).transferBatch(1, retailer.address);
      const tx = await pharmaNFT.connect(retailer).verifyBatch(1);
      await tx.wait();
      expect(tx).to.not.be.null;
    });

    it("Should not allow manufacturer to verify batch", async function () {
      await expect(
        pharmaNFT.connect(manufacturer).verifyBatch(1)
      ).to.be.revertedWith("Unauthorized verifier");
    });

    it("Should emit BatchVerified event", async function () {
      await expect(pharmaNFT.connect(distributor).verifyBatch(1))
        .to.emit(pharmaNFT, "BatchVerified")
        .withArgs(1, distributor.address, true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("Batch Linking", function () {
    beforeEach(async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
      await mintBatch(manufacturer, "BATCH001");
      await mintBatch(manufacturer, "BATCH002");
    });

    it("Should allow manufacturer to link batches", async function () {
      await expect(pharmaNFT.connect(manufacturer).linkChildBatch(1, 2))
        .to.emit(pharmaNFT, "ChildBatchLinked")
        .withArgs(1, 2);

      const childBatches = await pharmaNFT.getChildBatches(1);
      expect(childBatches.length).to.equal(1);
      expect(childBatches[0]).to.equal(2);

      const parentBatch = await pharmaNFT.getParentBatch(2);
      expect(parentBatch).to.equal(1);
    });

    it("Should not allow non-manufacturer to link batches", async function () {
      await pharmaNFT.setRole(distributor.address, 2);
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);

      await expect(
        pharmaNFT.connect(distributor).linkChildBatch(1, 2)
      ).to.be.revertedWith("Only manufacturers can perform this action");
    });

    it("Should not allow linking non-existent child batch", async function () {
      await expect(
        pharmaNFT.connect(manufacturer).linkChildBatch(1, 999)
      ).to.be.revertedWith("Child token doesn't exist");
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("QR Scan & Counterfeit Detection", function () {
    beforeEach(async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
      await pharmaNFT.setRole(distributor.address, 2);
      await mintBatch(manufacturer, "BATCH001");
      await pharmaNFT.connect(manufacturer).transferBatch(1, distributor.address);
    });

    it("Should allow distributor to record a scan", async function () {
      await expect(pharmaNFT.connect(distributor).recordScan(1))
        .to.emit(pharmaNFT, "BatchScanned")
        .withArgs(1, 2, distributor.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should flag counterfeit and revert on double-scan by same role", async function () {
      await pharmaNFT.connect(distributor).recordScan(1);
      await expect(
        pharmaNFT.connect(distributor).recordScan(1)
      ).to.be.revertedWith("Already scanned for this role");
    });

    it("Should flag counterfeit and revert on wrong-role scan", async function () {
      // Retailer tries to scan while batch is at Distributor — wrong role
      await pharmaNFT.setRole(retailer.address, 3);
      await expect(
        pharmaNFT.connect(retailer).recordScan(1)
      ).to.be.revertedWith("Scan by wrong role");
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe("Edge Cases", function () {
    it("Should return empty transfer history for freshly minted batch", async function () {
      await pharmaNFT.registerManufacturer(manufacturer.address);
      await mintBatch(manufacturer, "BATCH001");

      const history = await pharmaNFT.getTransferHistory(1);
      expect(history.length).to.equal(0);
    });

    it("Should return Role.None (0) for addresses without roles", async function () {
      const role = await pharmaNFT.getRole(otherAccount.address);
      expect(role).to.equal(0);
    });
  });
});
