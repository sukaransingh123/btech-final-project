const { ethers } = require('ethers');
const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', 'env') });

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';

// Contract ABI (minimal for event listening)
const CONTRACT_ABI = [
  "event BatchMinted(uint256 indexed tokenId, address indexed owner, string batchID)",
  "event OwnershipTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint8 newRole)",
  "event BatchVerified(uint256 indexed tokenId, address indexed verifier, bool valid)",
  "event ChildBatchLinked(uint256 indexed parentId, uint256 indexed childId)",
  "function getBatchDetails(uint256 tokenId) view returns (tuple(uint256 tokenId, address currentOwner, uint8 currentRole, string batchID, string metadataHash, string metadataURI, string qrCodeURI, uint256 timestamp, address manufacturer))",
  "function getTransferHistory(uint256 tokenId) view returns (tuple(address from, address to, uint256 timestamp, uint8 fromRole, uint8 toRole)[])",
  "function getRole(address user) view returns (uint8)",
  "function isCounterfeit(uint256 tokenId) view returns (bool)",
  "function scannedByRole(uint256 tokenId, uint8 role) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getParentBatch(uint256 tokenId) view returns (uint256)"
];

const ROLE_MAP = {
  0: 'None',
  1: 'Manufacturer',
  2: 'Distributor',
  3: 'Retailer',
  4: 'Pharmacy'
};

let provider;
let contract;
let listenersActive = false;

/**
 * Initialize blockchain listener
 */
async function initializeListener() {
  if (!CONTRACT_ADDRESS) {
    console.log('⚠️  CONTRACT_ADDRESS not set. Blockchain listener disabled.');
    return;
  }

  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log('📡 Blockchain listener initialized');
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Network: ${RPC_URL}`);

    // Start listening to events
    startEventListeners();

    // Sync existing data (one-time on startup)
    syncExistingData();
  } catch (error) {
    console.error('❌ Error initializing blockchain listener:', error);
  }
}

/**
 * Start listening to blockchain events
 */
function startEventListeners() {
  if (listenersActive) {
    console.log('⚠️  Listeners already active');
    return;
  }

  // Listen for BatchMinted events
  contract.on('BatchMinted', async (tokenId, owner, batchID, event) => {
    console.log(`\n📦 Batch Minted Event:`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Batch ID: ${batchID}`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Block: ${event.blockNumber}`);

    try {
      await handleBatchMinted(tokenId, owner, batchID);
    } catch (error) {
      console.error('Error handling BatchMinted:', error);
    }
  });

  // Listen for OwnershipTransferred events
  contract.on('OwnershipTransferred', async (tokenId, from, to, newRole, event) => {
    console.log(`\n🔄 Transfer Event:`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   New Role: ${ROLE_MAP[Number(newRole)]}`);

    try {
      await handleOwnershipTransferred(tokenId, from, to, newRole);
    } catch (error) {
      console.error('Error handling OwnershipTransferred:', error);
    }
  });

  // Listen for BatchVerified events
  contract.on('BatchVerified', async (tokenId, verifier, valid, event) => {
    console.log(`\n✅ Verification Event:`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Verifier: ${verifier}`);
    console.log(`   Valid: ${valid}`);

    try {
      await handleBatchVerified(tokenId, verifier, valid);
    } catch (error) {
      console.error('Error handling BatchVerified:', error);
    }
  });

  listenersActive = true;
  console.log('✅ Blockchain event listeners started');
}

/**
 * Handle BatchMinted event
 */
async function handleBatchMinted(tokenId, owner, batchID) {
  try {
    // First try to find by batchID (created before mint)
    let batch = await Batch.findByBatchID(batchID);

    if (batch) {
      // Get on-chain batch details to sync metadataHash
      const onChainBatch = await contract.getBatchDetails(Number(tokenId));
      
      // Update with tokenId, contract address, and metadataHash if not set
      const updated = {};
      if (!batch.tokenId || batch.tokenId !== Number(tokenId)) {
        updated.tokenId = Number(tokenId);
      }
      if (!batch.contractAddress || batch.contractAddress !== CONTRACT_ADDRESS) {
        updated.contractAddress = CONTRACT_ADDRESS;
      }
      // Sync metadataHash from blockchain (critical for integrity verification)
      if (onChainBatch.metadataHash && (!batch.metadataHash || batch.metadataHash !== onChainBatch.metadataHash)) {
        updated.metadataHash = onChainBatch.metadataHash;
        console.log(`   ⚠️  Syncing metadataHash from blockchain`);
      }
      
      if (Object.keys(updated).length > 0) {
        Object.assign(batch, updated);
        await batch.save();
        console.log(`   ✓ Linked batch ${batchID} to tokenId ${tokenId} with blockchain data`);
      }
    } else {
      // Try finding by tokenId (in case batch was created after mint)
      batch = await Batch.findByTokenId(Number(tokenId));
      if (batch) {
        console.log(`   ✓ Batch already linked: ${batch.batchID} -> tokenId ${tokenId}`);
      } else {
        console.log(`   ⚠️  Batch ${batchID} not found in MongoDB. Event listener will create entry after fetching on-chain data...`);
        
        // Optionally create a basic entry from on-chain data (using upsert to avoid duplicates)
        try {
          const onChainBatch = await contract.getBatchDetails(Number(tokenId));
          // Use findOneAndUpdate with upsert to handle race conditions
          const existing = await Batch.findOne({ batchID: batchID });
          if (existing) {
            // Update existing batch with tokenId if not set
            if (!existing.tokenId || existing.tokenId !== Number(tokenId)) {
              existing.tokenId = Number(tokenId);
              existing.contractAddress = CONTRACT_ADDRESS;
              existing.metadataHash = onChainBatch.metadataHash || existing.metadataHash || '';
              await existing.save();
              console.log(`   ✓ Updated existing batch ${batchID} with tokenId ${tokenId}`);
            }
          } else {
            const newBatch = new Batch({
              tokenId: Number(tokenId),
              batchID: batchID,
              contractAddress: CONTRACT_ADDRESS,
              currentOwner: owner.toLowerCase(),
              currentRole: 'Manufacturer',
              manufacturer: onChainBatch.manufacturer.toLowerCase(),
              drugName: 'Unknown', // Not stored on-chain
              manufacturingDate: new Date(Number(onChainBatch.timestamp) * 1000),
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
              quantity: 1,
              metadataHash: onChainBatch.metadataHash || '', // Sync from blockchain
              status: 'Created'
            });
            await newBatch.save();
            console.log(`   ✓ Created batch entry from blockchain event: ${batchID}`);
          }
        } catch (createError) {
          // Handle duplicate key error gracefully
          if (createError.code === 11000) {
            console.log(`   ⚠️  Batch ${batchID} already exists (duplicate key), skipping creation`);
            // Try to update it instead
            try {
              const existing = await Batch.findOne({ batchID: batchID });
              if (existing && (!existing.tokenId || existing.tokenId !== Number(tokenId))) {
                existing.tokenId = Number(tokenId);
                existing.contractAddress = CONTRACT_ADDRESS;
                await existing.save();
                console.log(`   ✓ Updated existing batch ${batchID} with tokenId ${tokenId}`);
              }
            } catch (updateError) {
              console.log(`   ⚠️  Could not update existing batch: ${updateError.message}`);
            }
          } else {
            console.log(`   ⚠️  Could not auto-create batch: ${createError.message}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error handling BatchMinted for token ${tokenId}:`, error);
  }
}

/**
 * Handle OwnershipTransferred event
 */
async function handleOwnershipTransferred(tokenId, from, to, newRole) {
  try {
    const batch = await Batch.findByTokenId(Number(tokenId));
    
    if (!batch) {
      console.log(`   ⚠️  Batch with tokenId ${tokenId} not found in MongoDB`);
      return;
    }

    // Get transfer history and on-chain batch details from blockchain (source of truth)
    const transferHistory = await contract.getTransferHistory(tokenId);
    const latestTransfer = transferHistory[transferHistory.length - 1];
    const onChainBatch = await contract.getBatchDetails(tokenId);
    
    // Sync CRITICAL data from blockchain (source of truth)
    batch.currentOwner = onChainBatch.currentOwner.toLowerCase();
    batch.currentRole = ROLE_MAP[Number(newRole)];
    
    // Sync metadataHash from blockchain if different (ensures integrity)
    if (onChainBatch.metadataHash && onChainBatch.metadataHash !== batch.metadataHash) {
      batch.metadataHash = onChainBatch.metadataHash;
      console.log(`   ⚠️  MetadataHash synced from blockchain for batch ${batch.batchID}`);
    }
    
    // Sync isCounterfeit flag from blockchain
    try {
      const onChainCounterfeit = await contract.isCounterfeit(tokenId);
      if (onChainCounterfeit !== batch.isCounterfeit) {
        batch.isCounterfeit = onChainCounterfeit;
        console.log(`   ⚠️  Counterfeit flag synced: ${onChainCounterfeit}`);
      }
    } catch (e) {
      // isCounterfeit might not be in ABI, continue
    }
    
    // Update status based on role
    if (ROLE_MAP[Number(newRole)] === 'Pharmacy') {
      batch.status = 'Delivered';
    } else {
      batch.status = 'InTransit';
    }

    // Add to history if not already present
    const transferExists = batch.history.some(
      h => h.from.toLowerCase() === from.toLowerCase() && 
           h.to.toLowerCase() === to.toLowerCase() &&
           Math.abs(new Date(h.timestamp) - new Date()) < 60000 // Within 1 minute
    );

    if (!transferExists) {
      batch.history.push({
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        fromRole: ROLE_MAP[Number(latestTransfer?.fromRole || 0)],
        toRole: ROLE_MAP[Number(newRole)],
        timestamp: new Date(),
        txHash: null // Could get from event if needed
      });
    }

    batch.updatedAt = new Date();
    await batch.save();

    console.log(`   ✓ Updated batch ${batch.batchID} ownership, role, and history from blockchain`);
  } catch (error) {
    console.error(`Error handling OwnershipTransferred for token ${tokenId}:`, error);
  }
}

/**
 * Handle BatchVerified event
 */
async function handleBatchVerified(tokenId, verifier, valid) {
  try {
    const batch = await Batch.findByTokenId(Number(tokenId));
    
    if (!batch) {
      return;
    }

    // Could update verification status here if needed
    // For now, just log it
    console.log(`   ✓ Verification recorded for batch ${batch.batchID}`);
  } catch (error) {
    console.error(`Error handling BatchVerified for token ${tokenId}:`, error);
  }
}

/**
 * Sync existing blockchain data with MongoDB (one-time on startup)
 */
async function syncExistingData() {
  if (!contract) return;

  try {
    console.log('\n🔄 Syncing existing blockchain data...');

    // Get all batches from MongoDB that have tokenId
    const batches = await Batch.find({ tokenId: { $exists: true, $ne: null } });

    console.log(`   Found ${batches.length} batches to sync`);

    for (const batch of batches) {
      try {
        // Fetch latest state from blockchain (source of truth for critical data)
        const onChainBatch = await contract.getBatchDetails(batch.tokenId);
        const onChainOwner = await contract.ownerOf(batch.tokenId);
        const role = await contract.getRole(onChainOwner);
        const onChainCounterfeit = await contract.isCounterfeit(batch.tokenId);

        let needsUpdate = false;
        
        // Sync CRITICAL on-chain data
        if (onChainOwner.toLowerCase() !== batch.currentOwner.toLowerCase()) {
          batch.currentOwner = onChainOwner.toLowerCase();
          needsUpdate = true;
        }
        if (ROLE_MAP[Number(role)] !== batch.currentRole) {
          batch.currentRole = ROLE_MAP[Number(role)];
          needsUpdate = true;
        }
        if (onChainBatch.metadataHash && onChainBatch.metadataHash !== batch.metadataHash) {
          batch.metadataHash = onChainBatch.metadataHash;
          needsUpdate = true;
        }
        if (onChainCounterfeit !== batch.isCounterfeit) {
          batch.isCounterfeit = onChainCounterfeit;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await batch.save();
          console.log(`   ✓ Synced batch ${batch.batchID} (owner, role, metadataHash, counterfeit)`);
        }
      } catch (error) {
        // Token might not exist on-chain yet, skip
        console.log(`   ⚠️  Could not sync batch ${batch.batchID}: ${error.message}`);
      }
    }

    console.log('✅ Sync completed\n');
  } catch (error) {
    console.error('Error syncing existing data:', error);
  }
}

// Initialize listener when module loads
setTimeout(() => {
  if (mongoose.connection.readyState === 1) {
    initializeListener();
  } else {
    // Wait for MongoDB connection
    mongoose.connection.once('connected', () => {
      initializeListener();
    });
  }
}, 1000);

module.exports = {
  initializeListener,
  startEventListeners
};

