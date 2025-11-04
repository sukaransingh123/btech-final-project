// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract PharmaNFT is ERC721URIStorage, Ownable {

    uint256 public tokenCounter;

    enum Role { None, Manufacturer, Distributor, Retailer, Pharmacy }

    struct Batch {
        uint256 tokenId;
        address currentOwner;
        Role currentRole;
        string batchID;
        string metadataHash; // SHA-256 hash of MongoDB metadata (for integrity verification)
        string metadataURI;
        string qrCodeURI;
        uint256 timestamp;
        address manufacturer;
    }

    // Pure signature recovery (payload hash must be keccak256 of encoded fields)
    function recoverSigner(bytes32 messageHash, bytes calldata signature) public pure returns (address) {
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        return ECDSA.recover(ethSigned, signature);
    }

    // Verify lineage back to a root (parentId == 0)
    function verifyLineage(uint256 tokenId) public view returns (bool) {
        uint256 currentId = tokenId;
        while (currentId != 0) {
            if (_ownerOf(currentId) == address(0)) return false;
            uint256 p = parentBatch[currentId];
            if (p == 0) return true;
            currentId = p;
        }
        return true;
    }

    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
        Role fromRole;
        Role toRole;
    }

    mapping(uint256 => Batch) public batches;
    mapping(address => Role) public roles;
    mapping(address => bool) public isManufacturer;
    mapping(address => bytes) public publicKeys;
    mapping(uint256 => TransferRecord[]) public transferHistory;
    mapping(uint256 => uint256[]) public childBatches;
    mapping(uint256 => uint256) public parentBatch;

    // Scan tracking: ensure main QR is scanned only once per role (Distributor, Retailer)
    mapping(uint256 => mapping(Role => bool)) public scannedByRole;
    mapping(uint256 => mapping(Role => uint256)) public scanTimestamp;
    // Child scan tracking for consumers (optional timestamp)
    mapping(uint256 => uint256) public childScanTimestamp;
    // Counterfeit flag per parent token
    mapping(uint256 => bool) public isCounterfeit;

    event BatchMinted(uint256 indexed tokenId, address indexed owner, string batchID);
    event OwnershipTransferred(uint256 indexed tokenId, address indexed from, address indexed to, Role newRole);
    event BatchVerified(uint256 indexed tokenId, address indexed verifier, bool valid);
    event ManufacturerRegistered(address indexed manufacturer);
    event ChildBatchLinked(uint256 indexed parentId, uint256 indexed childId);
    event BatchScanned(uint256 indexed tokenId, Role indexed byRole, address indexed scanner, uint256 timestamp);
    event ChildScanned(uint256 indexed childId, address indexed scanner, uint256 timestamp);
    event StakeholderRegistered(address indexed user, Role role, bytes pubKey);

    constructor() ERC721("PharmaBatchNFT", "PHB") Ownable(msg.sender) {
        tokenCounter = 1;
    }

    modifier onlyRole(Role role) {
        require(roles[msg.sender] == role, "Unauthorized Role");
        _;
    }

    modifier onlyManufacturer() {
        require(isManufacturer[msg.sender], "Only manufacturers can perform this action");
        _;
    }

    function setRole(address user, Role role) external onlyOwner {
        roles[user] = role;
    }

    function registerManufacturer(address _manufacturer) external onlyOwner {
        isManufacturer[_manufacturer] = true;
        roles[_manufacturer] = Role.Manufacturer;
        emit ManufacturerRegistered(_manufacturer);
    }

    function registerStakeholder(address user, Role role, bytes calldata pubKey) external onlyOwner {
        roles[user] = role;
        publicKeys[user] = pubKey;
        if (role == Role.Manufacturer) {
            isManufacturer[user] = true;
        }
        emit StakeholderRegistered(user, role, pubKey);
    }

    function mintBatch(string memory tokenURI, string memory batchID, string memory metadataHash) public onlyManufacturer {
        uint256 tokenId = tokenCounter++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        batches[tokenId] = Batch({
            tokenId: tokenId,
            currentOwner: msg.sender,
            currentRole: Role.Manufacturer,
            batchID: batchID,
            metadataHash: metadataHash, // Store hash on-chain for verification
            metadataURI: tokenURI,
            qrCodeURI: tokenURI,
            timestamp: block.timestamp,
            manufacturer: msg.sender
        });

        emit BatchMinted(tokenId, msg.sender, batchID);
    }

    function transferBatch(uint256 tokenId, address newOwner) public {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");

        Role current = batches[tokenId].currentRole;
        Role next = roles[newOwner];

        // New workflow:
        // Manufacturer -> Distributor OR Retailer
        // Distributor -> Retailer
        // Retailer -> none (end of chain)
        require(
            (current == Role.Manufacturer && (next == Role.Distributor || next == Role.Retailer)) ||
            (current == Role.Distributor && next == Role.Retailer),
            "Invalid transfer"
        );

        // Block transfers for flagged batches
        require(!isCounterfeit[tokenId], "Batch flagged counterfeit");
        // Require scan by current role before transferring forward (except Manufacturer)
        if (current != Role.Manufacturer) {
            require(scannedByRole[tokenId][current], "Scan required before transfer");
        }

        // Record transfer history
        transferHistory[tokenId].push(TransferRecord({
            from: msg.sender,
            to: newOwner,
            timestamp: block.timestamp,
            fromRole: current,
            toRole: next
        }));

        _transfer(msg.sender, newOwner, tokenId);
        batches[tokenId].currentOwner = newOwner;
        batches[tokenId].currentRole = next;

        emit OwnershipTransferred(tokenId, msg.sender, newOwner, next);
    }

    // Bulk transfer: transfer a parent token and all its child tokens in a single transaction
    function transferParentAndChildren(uint256 parentId, address newOwner) public {
        require(_ownerOf(parentId) != address(0), "Parent token doesn't exist");
        require(ownerOf(parentId) == msg.sender, "Not the owner of parent");

        Role current = batches[parentId].currentRole;
        Role next = roles[newOwner];
        require(
            (current == Role.Manufacturer && (next == Role.Distributor || next == Role.Retailer)) ||
            (current == Role.Distributor && next == Role.Retailer),
            "Invalid transfer"
        );

        // Block transfers for flagged batches
        require(!isCounterfeit[parentId], "Batch flagged counterfeit");
        // Require scan by current role on parent before transferring hierarchy (except Manufacturer)
        if (current != Role.Manufacturer) {
            require(scannedByRole[parentId][current], "Scan required before transfer");
        }

        // Record and transfer parent first
        transferHistory[parentId].push(TransferRecord({
            from: msg.sender,
            to: newOwner,
            timestamp: block.timestamp,
            fromRole: current,
            toRole: next
        }));
        _transfer(msg.sender, newOwner, parentId);
        batches[parentId].currentOwner = newOwner;
        batches[parentId].currentRole = next;
        emit OwnershipTransferred(parentId, msg.sender, newOwner, next);

        // Transfer all linked children
        uint256[] storage children = childBatches[parentId];
        for (uint256 i = 0; i < children.length; i++) {
            uint256 childId = children[i];
            if (_ownerOf(childId) == msg.sender) { // only transfer if sender owns the child
                transferHistory[childId].push(TransferRecord({
                    from: msg.sender,
                    to: newOwner,
                    timestamp: block.timestamp,
                    fromRole: current,
                    toRole: next
                }));
                _transfer(msg.sender, newOwner, childId);
                batches[childId].currentOwner = newOwner;
                batches[childId].currentRole = next;
                emit OwnershipTransferred(childId, msg.sender, newOwner, next);
            }
        }
    }

    // Record scan of main QR by Distributor or Retailer; only once per role
    function recordScan(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        Role r = roles[msg.sender];
        require(r == Role.Manufacturer || r == Role.Distributor || r == Role.Retailer, "Scan not allowed for role");
        // Wrong-role scan flags counterfeit and reverts
        if (r != batches[tokenId].currentRole) {
            isCounterfeit[tokenId] = true;
            revert("Scan by wrong role");
        }
        if (scannedByRole[tokenId][r]) {
            // Multiple scans by same role mark as counterfeit
            isCounterfeit[tokenId] = true;
            revert("Already scanned for this role");
        }
        scannedByRole[tokenId][r] = true;
        scanTimestamp[tokenId][r] = block.timestamp;
        emit BatchScanned(tokenId, r, msg.sender, block.timestamp);
    }

    // Record child scan (e.g., consumer scan). No role restriction.
    function recordChildScan(uint256 childId) public {
        require(_ownerOf(childId) != address(0), "Child token doesn't exist");
        childScanTimestamp[childId] = block.timestamp;
        emit ChildScanned(childId, msg.sender, block.timestamp);
    }

    // Verification function for Distributor, Retailer, Pharmacy
    function verifyBatch(uint256 tokenId) public returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        Role userRole = roles[msg.sender];
        require(
            userRole == Role.Distributor || userRole == Role.Retailer || userRole == Role.Pharmacy,
            "Unauthorized verifier"
        );
        Batch memory batch = batches[tokenId];
        bool valid = ownerOf(tokenId) == batch.currentOwner;
        emit BatchVerified(tokenId, msg.sender, valid);
        return valid;
    }

    function getBatchDetails(uint256 tokenId) public view returns (Batch memory) {
        return batches[tokenId];
    }

    function linkChildBatch(uint256 parentId, uint256 childId) public onlyManufacturer {
        require(_ownerOf(parentId) != address(0), "Parent token doesn't exist");
        require(_ownerOf(childId) != address(0), "Child token doesn't exist");
        require(batches[parentId].manufacturer == msg.sender, "Not the manufacturer of parent batch");
        require(batches[childId].manufacturer == msg.sender, "Not the manufacturer of child batch");
        
        childBatches[parentId].push(childId);
        parentBatch[childId] = parentId;
        
        emit ChildBatchLinked(parentId, childId);
    }

    // Bulk mint child batches and link to a parent batch
    function mintChildBatches(uint256 parentId, uint256 count, string memory childTokenURI) public onlyManufacturer {
        require(_ownerOf(parentId) != address(0), "Parent token doesn't exist");
        require(batches[parentId].manufacturer == msg.sender, "Not the manufacturer of parent batch");
        require(count > 0 && count <= 1000, "Invalid count");
        for (uint256 i = 0; i < count; i++) {
            uint256 childId = tokenCounter++;
            _mint(msg.sender, childId);
            _setTokenURI(childId, childTokenURI);
            batches[childId] = Batch({
                tokenId: childId,
                currentOwner: msg.sender,
                currentRole: Role.Manufacturer,
                batchID: string(abi.encodePacked(batches[parentId].batchID, "-C", _toString(childId))),
                metadataHash: batches[parentId].metadataHash, // Inherit parent's metadataHash
                metadataURI: childTokenURI,
                qrCodeURI: childTokenURI,
                timestamp: block.timestamp,
                manufacturer: msg.sender
            });
            childBatches[parentId].push(childId);
            parentBatch[childId] = parentId;
            emit ChildBatchLinked(parentId, childId);
        }
    }

    function getTransferHistory(uint256 tokenId) public view returns (TransferRecord[] memory) {
        return transferHistory[tokenId];
    }

    function getChildBatches(uint256 parentId) public view returns (uint256[] memory) {
        return childBatches[parentId];
    }

    function getParentBatch(uint256 childId) public view returns (uint256) {
        return parentBatch[childId];
    }

    function getRole(address user) public view returns (Role) {
        return roles[user];
    }

    // Helper to convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

}
