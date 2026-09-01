// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PharmaSupplyChain
 * @author B.Tech PBL Project — Blockchain-Based Pharmaceutical Supply Chain Tracker
 * @notice Tracks pharmaceutical batches across the full supply chain with
 *         role-based access, digital signatures, and tamper-proof event history.
 *
 * Supply Chain Flow:
 *   Supplier → Manufacturer → Distributor → Pharmacy → Consumer
 *
 * Stages:
 *   Produced → Shipped → InTransit → Delivered → Dispensed
 */
contract PharmaSupplyChain is Ownable {

    // ═══════════════════════════════════════════════════════════════
    //  ENUMS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Roles in the supply chain
    enum Role {
        None,           // 0 — unregistered address
        Supplier,       // 1 — raw material supplier
        Manufacturer,   // 2 — drug manufacturer
        Distributor,    // 3 — logistics / distributor
        Retailer,       // 4 — retailer
        Pharmacy,       // 5 — pharmacy
        Consumer        // 6 — end patient (assigned on dispense)
    }

    /// @notice Lifecycle stages of a pharmaceutical batch
    enum Stage {
        Produced,   // 0 — raw material added by Supplier
        Shipped,    // 1 — manufactured and ready to ship
        InTransit,  // 2 — in transit with Distributor
        AtRetailer, // 3 — delivered to Retailer
        Delivered,  // 4 — delivered to Pharmacy
        Dispensed   // 5 — dispensed to patient / Consumer
    }

    // ═══════════════════════════════════════════════════════════════
    //  STRUCTS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Core batch record stored on-chain.
     * @dev digitalSignature = keccak256 of (batchId, drugName, sender, timestamp, blockNumber)
     *      recomputed at every lifecycle step for non-repudiation.
     */
    struct Batch {
        uint256  batchId;           // unique auto-incremented ID
        string   drugName;          // name of the pharmaceutical drug
        address  supplier;          // raw material supplier address
        address  manufacturer;      // manufacturer address
        address  distributor;       // distributor address
        address  retailer;          // retailer address
        address  pharmacy;          // pharmacy address
        address  currentOwner;      // who currently holds the batch
        uint256  timestamp;         // last state-change timestamp
        Stage    stage;             // current lifecycle stage
        bytes32  digitalSignature;  // keccak256 hash — changes every step
        bool     isCounterfeit;     // flagged by owner if fake
        string   metadataURI;       // IPFS URI for QA certs, lab reports, etc.
    }

    /**
     * @notice Immutable record of every custody transfer — tamper-proof history.
     */
    struct TransferRecord {
        address  from;
        address  to;
        Role     fromRole;
        Role     toRole;
        Stage    stage;
        uint256  timestamp;
        bytes32  digitalSignature;  // signature at time of this transfer
    }

    // ═══════════════════════════════════════════════════════════════
    //  STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════

    /// @notice Maps wallet address → assigned role
    mapping(address => Role) public roles;

    /// @notice Maps batchId → Batch struct
    mapping(uint256 => Batch) public batches;

    /// @notice Maps batchId → full ordered transfer history
    mapping(uint256 => TransferRecord[]) public transferHistory;

    /// @notice Total number of batches created (also next batchId)
    uint256 public batchCounter;

    // ═══════════════════════════════════════════════════════════════
    //  EVENTS — Non-repudiation: every state transition is logged
    //           with sender address, timestamp, and digital signature
    // ═══════════════════════════════════════════════════════════════

    event RoleAssigned(
        address indexed account,
        Role            role,
        address indexed assignedBy,
        uint256         timestamp
    );

    /// @notice Emitted when a supplier adds raw material (Stage: Produced)
    event RawMaterialAdded(
        uint256 indexed batchId,
        address indexed supplier,
        string          drugName,
        Stage           stage,
        bytes32         digitalSignature,
        uint256         timestamp
    );

    /// @notice Emitted when manufacturer processes raw material (Stage: Shipped)
    event BatchManufactured(
        uint256 indexed batchId,
        address indexed manufacturer,
        string          drugName,
        Stage           stage,
        bytes32         digitalSignature,
        uint256         timestamp
    );

    /// @notice Emitted when manufacturer ships to distributor (Stage: InTransit)
    event TransferredToDistributor(
        uint256 indexed batchId,
        address indexed from,
        address indexed distributor,
        Stage           stage,
        bytes32         digitalSignature,
        uint256         timestamp
    );

    event TransferredToRetailer(
        uint256 indexed batchId,
        address indexed from,
        address indexed retailer,
        Stage           stage,
        bytes32         digitalSignature,
        uint256         timestamp
    );

    /// @notice Emitted when retailer delivers to pharmacy (Stage: Delivered)
    event TransferredToPharmacy(
        uint256 indexed batchId,
        address indexed from,
        address indexed pharmacy,
        Stage           stage,
        bytes32         digitalSignature,
        uint256         timestamp
    );

    /// @notice Emitted when pharmacy dispenses to patient (Stage: Dispensed)
    event DispensedToPatient(
        uint256 indexed batchId,
        address indexed pharmacy,
        address indexed patient,
        Stage           stage,
        bytes32         digitalSignature,
        uint256         timestamp
    );

    /// @notice Emitted when a batch is flagged as counterfeit by the owner
    event CounterfeitFlagged(
        uint256 indexed batchId,
        address indexed flaggedBy,
        uint256         timestamp
    );

    /// @notice Emitted when anyone (including consumers) calls verifyBatch()
    event BatchVerified(
        uint256 indexed batchId,
        address indexed verifiedBy,
        bool            isAuthentic,
        Stage           stage,
        uint256         timestamp
    );

    // ═══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlySupplier() {
        require(roles[msg.sender] == Role.Supplier, "Access denied: Supplier role required");
        _;
    }

    modifier onlyManufacturer() {
        require(roles[msg.sender] == Role.Manufacturer, "Access denied: Manufacturer role required");
        _;
    }

    modifier onlyDistributor() {
        require(roles[msg.sender] == Role.Distributor, "Access denied: Distributor role required");
        _;
    }

    modifier onlyRetailer() {
        require(roles[msg.sender] == Role.Retailer, "Access denied: Retailer role required");
        _;
    }

    modifier onlyPharmacy() {
        require(roles[msg.sender] == Role.Pharmacy, "Access denied: Pharmacy role required");
        _;
    }

    modifier batchExists(uint256 batchId) {
        require(batchId < batchCounter, "Batch does not exist");
        _;
    }

    modifier notCounterfeit(uint256 batchId) {
        require(!batches[batchId].isCounterfeit, "Batch has been flagged as counterfeit");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {
        batchCounter = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ROLE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Assign a single role to an address. Only callable by contract owner.
     * @param account The wallet address to assign the role to
     * @param role    The Role enum value to assign
     */
    function assignRole(address account, Role role) external onlyOwner {
        require(account != address(0), "Cannot assign role to zero address");
        roles[account] = role;
        emit RoleAssigned(account, role, msg.sender, block.timestamp);
    }

    /**
     * @notice Batch-assign roles to multiple addresses in one transaction.
     * @param accounts Array of wallet addresses
     * @param _roles   Corresponding array of Role values
     */
    function assignRoleBatch(
        address[] calldata accounts,
        Role[]    calldata _roles
    ) external onlyOwner {
        require(accounts.length == _roles.length, "Array length mismatch");
        require(accounts.length > 0, "Empty arrays");
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Cannot assign role to zero address");
            roles[accounts[i]] = _roles[i];
            emit RoleAssigned(accounts[i], _roles[i], msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Returns the role of any address.
     */
    function getRole(address account) external view returns (Role) {
        return roles[account];
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIFECYCLE FUNCTION 1 — addRawMaterial()
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Supplier registers raw material, creating a new batch on-chain.
     * @dev    Stage transitions to: Produced
     * @param  drugName    Name of the pharmaceutical drug / raw material
     * @param  metadataURI IPFS URI for QA certificates and lab reports
     * @return batchId     The ID of the newly created batch
     */
    function addRawMaterial(
        string calldata drugName,
        string calldata metadataURI
    ) external onlySupplier returns (uint256 batchId) {
        require(bytes(drugName).length > 0, "Drug name cannot be empty");

        batchId = batchCounter++;

        bytes32 sig = keccak256(abi.encodePacked(
            batchId, drugName, msg.sender, block.timestamp, block.number
        ));

        batches[batchId] = Batch({
            batchId:          batchId,
            drugName:         drugName,
            supplier:         msg.sender,
            manufacturer:     address(0),
            distributor:      address(0),
            retailer:         address(0),
            pharmacy:         address(0),
            currentOwner:     msg.sender,
            timestamp:        block.timestamp,
            stage:            Stage.Produced,
            digitalSignature: sig,
            isCounterfeit:    false,
            metadataURI:      metadataURI
        });

        transferHistory[batchId].push(TransferRecord({
            from:             address(0),
            to:               msg.sender,
            fromRole:         Role.None,
            toRole:           Role.Supplier,
            stage:            Stage.Produced,
            timestamp:        block.timestamp,
            digitalSignature: sig
        }));

        emit RawMaterialAdded(batchId, msg.sender, drugName, Stage.Produced, sig, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIFECYCLE FUNCTION 2 — manufactureBatch()
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Manufacturer processes raw material into a finished drug batch.
     * @dev    Stage transitions to: Shipped
     * @param  batchId The ID of the batch to manufacture
     */
    function manufactureBatch(
        uint256 batchId
    ) external onlyManufacturer batchExists(batchId) notCounterfeit(batchId) {
        Batch storage batch = batches[batchId];
        require(batch.stage == Stage.Produced, "Batch must be at Produced stage");

        bytes32 sig = keccak256(abi.encodePacked(
            batchId, batch.drugName, msg.sender, block.timestamp, block.number
        ));

        address prevOwner    = batch.currentOwner;
        batch.manufacturer   = msg.sender;
        batch.currentOwner   = msg.sender;
        batch.stage          = Stage.Shipped;
        batch.timestamp      = block.timestamp;
        batch.digitalSignature = sig;

        transferHistory[batchId].push(TransferRecord({
            from:             prevOwner,
            to:               msg.sender,
            fromRole:         Role.Supplier,
            toRole:           Role.Manufacturer,
            stage:            Stage.Shipped,
            timestamp:        block.timestamp,
            digitalSignature: sig
        }));

        emit BatchManufactured(batchId, msg.sender, batch.drugName, Stage.Shipped, sig, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIFECYCLE FUNCTION 3 — transferToDistributor()
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Manufacturer ships the batch to a registered Distributor.
     * @dev    Stage transitions to: InTransit
     * @param  batchId      The batch to ship
     * @param  distributor  Wallet address of the distributor
     */
    function transferToDistributor(
        uint256 batchId,
        address distributor
    ) external onlyManufacturer batchExists(batchId) notCounterfeit(batchId) {
        require(roles[distributor] == Role.Distributor, "Recipient must have Distributor role");

        Batch storage batch = batches[batchId];
        require(batch.currentOwner == msg.sender, "Caller is not the current owner");
        require(batch.stage == Stage.Shipped, "Batch must be at Shipped stage");

        bytes32 sig = keccak256(abi.encodePacked(
            batchId, msg.sender, distributor, block.timestamp, block.number
        ));

        batch.distributor      = distributor;
        batch.currentOwner     = distributor;
        batch.stage            = Stage.InTransit;
        batch.timestamp        = block.timestamp;
        batch.digitalSignature = sig;

        transferHistory[batchId].push(TransferRecord({
            from:             msg.sender,
            to:               distributor,
            fromRole:         Role.Manufacturer,
            toRole:           Role.Distributor,
            stage:            Stage.InTransit,
            timestamp:        block.timestamp,
            digitalSignature: sig
        }));

        emit TransferredToDistributor(batchId, msg.sender, distributor, Stage.InTransit, sig, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIFECYCLE FUNCTION 4 — transferToRetailer()
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Distributor delivers the batch to a registered Retailer.
     * @dev    Stage transitions to: AtRetailer
     * @param  batchId   The batch to deliver
     * @param  retailer  Wallet address of the retailer
     */
    function transferToRetailer(
        uint256 batchId,
        address retailer
    ) external onlyDistributor batchExists(batchId) notCounterfeit(batchId) {
        require(roles[retailer] == Role.Retailer, "Recipient must have Retailer role");

        Batch storage batch = batches[batchId];
        require(batch.currentOwner == msg.sender, "Caller is not the current owner");
        require(batch.stage == Stage.InTransit, "Batch must be at InTransit stage");

        bytes32 sig = keccak256(abi.encodePacked(
            batchId, msg.sender, retailer, block.timestamp, block.number
        ));

        batch.retailer         = retailer;
        batch.currentOwner     = retailer;
        batch.stage            = Stage.AtRetailer;
        batch.timestamp        = block.timestamp;
        batch.digitalSignature = sig;

        transferHistory[batchId].push(TransferRecord({
            from:             msg.sender,
            to:               retailer,
            fromRole:         Role.Distributor,
            toRole:           Role.Retailer,
            stage:            Stage.AtRetailer,
            timestamp:        block.timestamp,
            digitalSignature: sig
        }));

        emit TransferredToRetailer(batchId, msg.sender, retailer, Stage.AtRetailer, sig, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIFECYCLE FUNCTION 5 — transferToPharmacy()
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Retailer delivers the batch to a registered Pharmacy.
     * @dev    Stage transitions to: Delivered
     * @param  batchId   The batch to deliver
     * @param  pharmacy  Wallet address of the pharmacy
     */
    function transferToPharmacy(
        uint256 batchId,
        address pharmacy
    ) external onlyRetailer batchExists(batchId) notCounterfeit(batchId) {
        require(roles[pharmacy] == Role.Pharmacy, "Recipient must have Pharmacy role");

        Batch storage batch = batches[batchId];
        require(batch.currentOwner == msg.sender, "Caller is not the current owner");
        require(batch.stage == Stage.AtRetailer, "Batch must be at AtRetailer stage");

        bytes32 sig = keccak256(abi.encodePacked(
            batchId, msg.sender, pharmacy, block.timestamp, block.number
        ));

        batch.pharmacy         = pharmacy;
        batch.currentOwner     = pharmacy;
        batch.stage            = Stage.Delivered;
        batch.timestamp        = block.timestamp;
        batch.digitalSignature = sig;

        transferHistory[batchId].push(TransferRecord({
            from:             msg.sender,
            to:               pharmacy,
            fromRole:         Role.Retailer,
            toRole:           Role.Pharmacy,
            stage:            Stage.Delivered,
            timestamp:        block.timestamp,
            digitalSignature: sig
        }));

        emit TransferredToPharmacy(batchId, msg.sender, pharmacy, Stage.Delivered, sig, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIFECYCLE FUNCTION 6 — dispenseToPatient()
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Pharmacy dispenses the batch to a patient (Consumer).
     * @dev    Stage transitions to: Dispensed — end of supply chain.
     * @param  batchId  The batch to dispense
     * @param  patient  Wallet address of the patient / consumer
     */
    function dispenseToPatient(
        uint256 batchId,
        address patient
    ) external onlyPharmacy batchExists(batchId) notCounterfeit(batchId) {
        require(patient != address(0), "Invalid patient address");

        Batch storage batch = batches[batchId];
        require(batch.currentOwner == msg.sender, "Caller is not the current owner");
        require(batch.stage == Stage.Delivered, "Batch must be at Delivered stage");

        bytes32 sig = keccak256(abi.encodePacked(
            batchId, msg.sender, patient, block.timestamp, block.number
        ));

        batch.currentOwner     = patient;
        batch.stage            = Stage.Dispensed;
        batch.timestamp        = block.timestamp;
        batch.digitalSignature = sig;

        transferHistory[batchId].push(TransferRecord({
            from:             msg.sender,
            to:               patient,
            fromRole:         Role.Pharmacy,
            toRole:           Role.Consumer,
            stage:            Stage.Dispensed,
            timestamp:        block.timestamp,
            digitalSignature: sig
        }));

        emit DispensedToPatient(batchId, msg.sender, patient, Stage.Dispensed, sig, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //  VIEW / QUERY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Returns full batch details for a given batchId.
     */
    function getBatch(uint256 batchId)
        external view batchExists(batchId)
        returns (Batch memory)
    {
        return batches[batchId];
    }

    /**
     * @notice Returns the complete transfer history for a batch.
     *         Each record is an immutable log of custody change with digital signature.
     */
    function getTransferHistory(uint256 batchId)
        external view batchExists(batchId)
        returns (TransferRecord[] memory)
    {
        return transferHistory[batchId];
    }

    /**
     * @notice Verify a batch — callable by anyone including consumers.
     *         Emits BatchVerified event for on-chain proof of verification.
     * @return isAuthentic      True if not flagged as counterfeit
     * @return stage            Current lifecycle stage
     * @return currentOwner     Current holder of the batch
     * @return digitalSignature Latest digital signature hash
     */
    function verifyBatch(uint256 batchId)
        external batchExists(batchId)
        returns (
            bool    isAuthentic,
            Stage   stage,
            address currentOwner,
            bytes32 digitalSignature
        )
    {
        Batch memory batch = batches[batchId];
        isAuthentic      = !batch.isCounterfeit;
        stage            = batch.stage;
        currentOwner     = batch.currentOwner;
        digitalSignature = batch.digitalSignature;

        emit BatchVerified(batchId, msg.sender, isAuthentic, stage, block.timestamp);
    }

    /**
     * @notice Returns total number of batches ever created.
     */
    function getTotalBatches() external view returns (uint256) {
        return batchCounter;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Flag a batch as counterfeit. Blocks all future transfers.
     *         Only callable by contract owner.
     */
    function flagCounterfeit(uint256 batchId)
        external onlyOwner batchExists(batchId)
    {
        require(!batches[batchId].isCounterfeit, "Already flagged");
        batches[batchId].isCounterfeit = true;
        emit CounterfeitFlagged(batchId, msg.sender, block.timestamp);
    }
}
