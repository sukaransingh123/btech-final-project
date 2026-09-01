const { expect }  = require("chai");
const { ethers }  = require("hardhat");

/**
 * Test suite for PharmaSupplyChain.sol
 * Covers: RBAC, all 5 lifecycle functions, non-repudiation events,
 *         counterfeit flagging, and edge cases.
 */
describe("PharmaSupplyChain", function () {

  // ── Shared state ──────────────────────────────────────────────
  let contract;
  let owner, supplier, manufacturer, distributor, pharmacy, consumer, stranger;

  const DRUG_NAME    = "Paracetamol 500mg";
  const METADATA_URI = "ipfs://QmExampleMetadataHash";

  // Role enum values (must match Solidity)
  const Role = { None: 0, Supplier: 1, Manufacturer: 2, Distributor: 3, Pharmacy: 4, Consumer: 5 };
  const Stage = { Produced: 0, Shipped: 1, InTransit: 2, Delivered: 3, Dispensed: 4 };

  beforeEach(async function () {
    [owner, supplier, manufacturer, distributor, pharmacy, consumer, stranger] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PharmaSupplyChain");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ══════════════════════════════════════════════════════════════
  //  1. DEPLOYMENT
  // ══════════════════════════════════════════════════════════════
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should initialize batchCounter to 0", async function () {
      expect(await contract.getTotalBatches()).to.equal(0);
    });

    it("Should assign Role.None to all unregistered addresses", async function () {
      expect(await contract.getRole(stranger.address)).to.equal(Role.None);
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  2. ROLE MANAGEMENT
  // ══════════════════════════════════════════════════════════════
  describe("Role Management", function () {
    it("Owner can assign individual roles", async function () {
      await contract.assignRole(supplier.address,     Role.Supplier);
      await contract.assignRole(manufacturer.address, Role.Manufacturer);
      await contract.assignRole(distributor.address,  Role.Distributor);
      await contract.assignRole(pharmacy.address,     Role.Pharmacy);

      expect(await contract.getRole(supplier.address)).to.equal(Role.Supplier);
      expect(await contract.getRole(manufacturer.address)).to.equal(Role.Manufacturer);
      expect(await contract.getRole(distributor.address)).to.equal(Role.Distributor);
      expect(await contract.getRole(pharmacy.address)).to.equal(Role.Pharmacy);
    });

    it("Owner can batch-assign roles in a single transaction", async function () {
      await contract.assignRoleBatch(
        [supplier.address, manufacturer.address, distributor.address, pharmacy.address],
        [Role.Supplier, Role.Manufacturer, Role.Distributor, Role.Pharmacy]
      );
      expect(await contract.getRole(supplier.address)).to.equal(Role.Supplier);
      expect(await contract.getRole(pharmacy.address)).to.equal(Role.Pharmacy);
    });

    it("assignRole emits RoleAssigned event", async function () {
      await expect(contract.assignRole(supplier.address, Role.Supplier))
        .to.emit(contract, "RoleAssigned")
        .withArgs(supplier.address, Role.Supplier, owner.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Non-owner cannot assign roles", async function () {
      await expect(
        contract.connect(stranger).assignRole(supplier.address, Role.Supplier)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("Cannot assign role to zero address", async function () {
      await expect(
        contract.assignRole(ethers.ZeroAddress, Role.Supplier)
      ).to.be.revertedWith("Cannot assign role to zero address");
    });

    it("assignRoleBatch reverts on array length mismatch", async function () {
      await expect(
        contract.assignRoleBatch([supplier.address], [Role.Supplier, Role.Manufacturer])
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  SETUP HELPER — assigns all roles before lifecycle tests
  // ══════════════════════════════════════════════════════════════
  async function setupRoles() {
    await contract.assignRoleBatch(
      [supplier.address, manufacturer.address, distributor.address, pharmacy.address],
      [Role.Supplier, Role.Manufacturer, Role.Distributor, Role.Pharmacy]
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  3. LIFECYCLE FUNCTION 1 — addRawMaterial()
  // ══════════════════════════════════════════════════════════════
  describe("addRawMaterial()", function () {
    beforeEach(setupRoles);

    it("Supplier can add raw material and get batchId 0", async function () {
      await expect(contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI))
        .to.emit(contract, "RawMaterialAdded")
        .withArgs(0, supplier.address, DRUG_NAME, Stage.Produced,
          (sig) => sig !== ethers.ZeroHash,   // digital signature must be non-zero
          (ts)  => ts > 0
        );

      expect(await contract.getTotalBatches()).to.equal(1);
    });

    it("Batch is created with correct initial state", async function () {
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
      const batch = await contract.getBatch(0);

      expect(batch.batchId).to.equal(0);
      expect(batch.drugName).to.equal(DRUG_NAME);
      expect(batch.supplier).to.equal(supplier.address);
      expect(batch.currentOwner).to.equal(supplier.address);
      expect(batch.stage).to.equal(Stage.Produced);
      expect(batch.isCounterfeit).to.be.false;
      expect(batch.metadataURI).to.equal(METADATA_URI);
      expect(batch.digitalSignature).to.not.equal(ethers.ZeroHash);
    });

    it("Transfer history has one entry after addRawMaterial", async function () {
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
      const history = await contract.getTransferHistory(0);

      expect(history.length).to.equal(1);
      expect(history[0].to).to.equal(supplier.address);
      expect(history[0].toRole).to.equal(Role.Supplier);
      expect(history[0].stage).to.equal(Stage.Produced);
    });

    it("Non-supplier cannot add raw material", async function () {
      await expect(
        contract.connect(manufacturer).addRawMaterial(DRUG_NAME, METADATA_URI)
      ).to.be.revertedWith("Access denied: Supplier role required");
    });

    it("Empty drug name is rejected", async function () {
      await expect(
        contract.connect(supplier).addRawMaterial("", METADATA_URI)
      ).to.be.revertedWith("Drug name cannot be empty");
    });

    it("batchCounter increments correctly for multiple batches", async function () {
      await contract.connect(supplier).addRawMaterial("Drug A", METADATA_URI);
      await contract.connect(supplier).addRawMaterial("Drug B", METADATA_URI);
      await contract.connect(supplier).addRawMaterial("Drug C", METADATA_URI);
      expect(await contract.getTotalBatches()).to.equal(3);
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  4. LIFECYCLE FUNCTION 2 — manufactureBatch()
  // ══════════════════════════════════════════════════════════════
  describe("manufactureBatch()", function () {
    beforeEach(async function () {
      await setupRoles();
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
    });

    it("Manufacturer can process a Produced batch → Shipped", async function () {
      await expect(contract.connect(manufacturer).manufactureBatch(0))
        .to.emit(contract, "BatchManufactured")
        .withArgs(0, manufacturer.address, DRUG_NAME, Stage.Shipped,
          (sig) => sig !== ethers.ZeroHash,
          (ts)  => ts > 0
        );

      const batch = await contract.getBatch(0);
      expect(batch.stage).to.equal(Stage.Shipped);
      expect(batch.manufacturer).to.equal(manufacturer.address);
      expect(batch.currentOwner).to.equal(manufacturer.address);
    });

    it("Digital signature changes after manufacture", async function () {
      const before = (await contract.getBatch(0)).digitalSignature;
      await contract.connect(manufacturer).manufactureBatch(0);
      const after  = (await contract.getBatch(0)).digitalSignature;
      expect(after).to.not.equal(before);  // signature must update
    });

    it("Transfer history has 2 entries after manufacture", async function () {
      await contract.connect(manufacturer).manufactureBatch(0);
      const history = await contract.getTransferHistory(0);
      expect(history.length).to.equal(2);
      expect(history[1].toRole).to.equal(Role.Manufacturer);
      expect(history[1].stage).to.equal(Stage.Shipped);
    });

    it("Non-manufacturer cannot manufacture", async function () {
      await expect(
        contract.connect(distributor).manufactureBatch(0)
      ).to.be.revertedWith("Access denied: Manufacturer role required");
    });

    it("Cannot manufacture a non-existent batch", async function () {
      await expect(
        contract.connect(manufacturer).manufactureBatch(999)
      ).to.be.revertedWith("Batch does not exist");
    });

    it("Cannot manufacture batch that is not at Produced stage", async function () {
      await contract.connect(manufacturer).manufactureBatch(0);
      await expect(
        contract.connect(manufacturer).manufactureBatch(0)
      ).to.be.revertedWith("Batch must be at Produced stage");
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  5. LIFECYCLE FUNCTION 3 — transferToDistributor()
  // ══════════════════════════════════════════════════════════════
  describe("transferToDistributor()", function () {
    beforeEach(async function () {
      await setupRoles();
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
      await contract.connect(manufacturer).manufactureBatch(0);
    });

    it("Manufacturer transfers Shipped batch to Distributor → InTransit", async function () {
      await expect(
        contract.connect(manufacturer).transferToDistributor(0, distributor.address)
      ).to.emit(contract, "TransferredToDistributor")
        .withArgs(0, manufacturer.address, distributor.address, Stage.InTransit,
          (sig) => sig !== ethers.ZeroHash, (ts) => ts > 0
        );

      const batch = await contract.getBatch(0);
      expect(batch.stage).to.equal(Stage.InTransit);
      expect(batch.distributor).to.equal(distributor.address);
      expect(batch.currentOwner).to.equal(distributor.address);
    });

    it("Transfer history has 3 entries after distributor transfer", async function () {
      await contract.connect(manufacturer).transferToDistributor(0, distributor.address);
      const history = await contract.getTransferHistory(0);
      expect(history.length).to.equal(3);
      expect(history[2].fromRole).to.equal(Role.Manufacturer);
      expect(history[2].toRole).to.equal(Role.Distributor);
    });

    it("Cannot transfer to non-distributor address", async function () {
      await expect(
        contract.connect(manufacturer).transferToDistributor(0, stranger.address)
      ).to.be.revertedWith("Recipient must have Distributor role");
    });

    it("Non-manufacturer cannot call transferToDistributor", async function () {
      await expect(
        contract.connect(supplier).transferToDistributor(0, distributor.address)
      ).to.be.revertedWith("Access denied: Manufacturer role required");
    });

    it("Cannot transfer if not the current owner", async function () {
      // Give ownership to someone else first by re-staging manually
      // (just test the revert via a second manufacturer attempt)
      await contract.connect(manufacturer).transferToDistributor(0, distributor.address);
      await expect(
        contract.connect(manufacturer).transferToDistributor(0, distributor.address)
      ).to.be.revertedWith("Caller is not the current owner");
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  6. LIFECYCLE FUNCTION 4 — transferToPharmacy()
  // ══════════════════════════════════════════════════════════════
  describe("transferToPharmacy()", function () {
    beforeEach(async function () {
      await setupRoles();
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
      await contract.connect(manufacturer).manufactureBatch(0);
      await contract.connect(manufacturer).transferToDistributor(0, distributor.address);
    });

    it("Distributor transfers InTransit batch to Pharmacy → Delivered", async function () {
      await expect(
        contract.connect(distributor).transferToPharmacy(0, pharmacy.address)
      ).to.emit(contract, "TransferredToPharmacy")
        .withArgs(0, distributor.address, pharmacy.address, Stage.Delivered,
          (sig) => sig !== ethers.ZeroHash, (ts) => ts > 0
        );

      const batch = await contract.getBatch(0);
      expect(batch.stage).to.equal(Stage.Delivered);
      expect(batch.pharmacy).to.equal(pharmacy.address);
      expect(batch.currentOwner).to.equal(pharmacy.address);
    });

    it("Transfer history has 4 entries after pharmacy transfer", async function () {
      await contract.connect(distributor).transferToPharmacy(0, pharmacy.address);
      const history = await contract.getTransferHistory(0);
      expect(history.length).to.equal(4);
      expect(history[3].toRole).to.equal(Role.Pharmacy);
      expect(history[3].stage).to.equal(Stage.Delivered);
    });

    it("Cannot transfer to non-pharmacy address", async function () {
      await expect(
        contract.connect(distributor).transferToPharmacy(0, stranger.address)
      ).to.be.revertedWith("Recipient must have Pharmacy role");
    });

    it("Non-distributor cannot call transferToPharmacy", async function () {
      await expect(
        contract.connect(manufacturer).transferToPharmacy(0, pharmacy.address)
      ).to.be.revertedWith("Access denied: Distributor role required");
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  7. LIFECYCLE FUNCTION 5 — dispenseToPatient()
  // ══════════════════════════════════════════════════════════════
  describe("dispenseToPatient()", function () {
    beforeEach(async function () {
      await setupRoles();
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
      await contract.connect(manufacturer).manufactureBatch(0);
      await contract.connect(manufacturer).transferToDistributor(0, distributor.address);
      await contract.connect(distributor).transferToPharmacy(0, pharmacy.address);
    });

    it("Pharmacy dispenses Delivered batch to patient → Dispensed", async function () {
      await expect(
        contract.connect(pharmacy).dispenseToPatient(0, consumer.address)
      ).to.emit(contract, "DispensedToPatient")
        .withArgs(0, pharmacy.address, consumer.address, Stage.Dispensed,
          (sig) => sig !== ethers.ZeroHash, (ts) => ts > 0
        );

      const batch = await contract.getBatch(0);
      expect(batch.stage).to.equal(Stage.Dispensed);
      expect(batch.currentOwner).to.equal(consumer.address);
    });

    it("Full transfer history has 5 records after complete lifecycle", async function () {
      await contract.connect(pharmacy).dispenseToPatient(0, consumer.address);
      const history = await contract.getTransferHistory(0);

      expect(history.length).to.equal(5);
      // Verify the full chain of roles
      expect(history[0].toRole).to.equal(Role.Supplier);
      expect(history[1].toRole).to.equal(Role.Manufacturer);
      expect(history[2].toRole).to.equal(Role.Distributor);
      expect(history[3].toRole).to.equal(Role.Pharmacy);
      expect(history[4].toRole).to.equal(Role.Consumer);
    });

    it("Every step has a unique digital signature (non-repudiation)", async function () {
      await contract.connect(pharmacy).dispenseToPatient(0, consumer.address);
      const history = await contract.getTransferHistory(0);

      const signatures = history.map(h => h.digitalSignature);
      const uniqueSet  = new Set(signatures);
      expect(uniqueSet.size).to.equal(5); // all 5 must be different
    });

    it("Non-pharmacy cannot dispense", async function () {
      await expect(
        contract.connect(distributor).dispenseToPatient(0, consumer.address)
      ).to.be.revertedWith("Access denied: Pharmacy role required");
    });

    it("Cannot dispense to zero address", async function () {
      await expect(
        contract.connect(pharmacy).dispenseToPatient(0, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid patient address");
    });

    it("Cannot dispense if batch is not at Delivered stage", async function () {
      // Already dispensed
      await contract.connect(pharmacy).dispenseToPatient(0, consumer.address);
      await expect(
        contract.connect(pharmacy).dispenseToPatient(0, consumer.address)
      ).to.be.revertedWith("Caller is not the current owner");
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  8. VERIFICATION — verifyBatch()
  // ══════════════════════════════════════════════════════════════
  describe("verifyBatch()", function () {
    beforeEach(async function () {
      await setupRoles();
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
    });

    it("Anyone can verify a batch — returns authentic=true for genuine batch", async function () {
      const [isAuthentic, stage] = await contract.connect(stranger).verifyBatch.staticCall(0);
      expect(isAuthentic).to.be.true;
      expect(stage).to.equal(Stage.Produced);
    });

    it("verifyBatch emits BatchVerified event", async function () {
      await expect(contract.connect(consumer).verifyBatch(0))
        .to.emit(contract, "BatchVerified");
    });

    it("Counterfeit batch returns isAuthentic=false", async function () {
      await contract.connect(owner).flagCounterfeit(0);
      const [isAuthentic] = await contract.connect(stranger).verifyBatch.staticCall(0);
      expect(isAuthentic).to.be.false;
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  9. COUNTERFEIT FLAGGING
  // ══════════════════════════════════════════════════════════════
  describe("flagCounterfeit()", function () {
    beforeEach(async function () {
      await setupRoles();
      await contract.connect(supplier).addRawMaterial(DRUG_NAME, METADATA_URI);
    });

    it("Owner can flag a batch as counterfeit", async function () {
      await expect(contract.connect(owner).flagCounterfeit(0))
        .to.emit(contract, "CounterfeitFlagged")
        .withArgs(0, owner.address, (ts) => ts > 0);

      const batch = await contract.getBatch(0);
      expect(batch.isCounterfeit).to.be.true;
    });

    it("Non-owner cannot flag counterfeit", async function () {
      await expect(
        contract.connect(stranger).flagCounterfeit(0)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("Cannot manufacture a counterfeit-flagged batch", async function () {
      await contract.connect(owner).flagCounterfeit(0);
      await expect(
        contract.connect(manufacturer).manufactureBatch(0)
      ).to.be.revertedWith("Batch has been flagged as counterfeit");
    });

    it("Cannot double-flag a batch", async function () {
      await contract.connect(owner).flagCounterfeit(0);
      await expect(
        contract.connect(owner).flagCounterfeit(0)
      ).to.be.revertedWith("Already flagged");
    });
  });

  // ══════════════════════════════════════════════════════════════
  //  10. EDGE CASES
  // ══════════════════════════════════════════════════════════════
  describe("Edge Cases", function () {
    it("getBatch reverts for non-existent batchId", async function () {
      await expect(contract.getBatch(0)).to.be.revertedWith("Batch does not exist");
    });

    it("getTransferHistory reverts for non-existent batchId", async function () {
      await expect(contract.getTransferHistory(0)).to.be.revertedWith("Batch does not exist");
    });

    it("Unregistered address gets Role.None", async function () {
      expect(await contract.getRole(stranger.address)).to.equal(Role.None);
    });
  });
});
