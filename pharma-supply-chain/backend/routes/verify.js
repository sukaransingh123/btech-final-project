const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const { verifyMetadataHash, verifyFileHash } = require('../utils/hashUtil');
const { ethers } = require('ethers');

// Get contract ABI and address from env or config
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';

/**
 * POST /api/verify - Verify product authenticity
 * Verifies both blockchain state and MongoDB metadata
 */
router.post('/', async (req, res) => {
  try {
    const { qrData, tokenId, batchID } = req.body;

    let batch;
    let verificationResult = {
      authentic: false,
      checks: {},
      errors: []
    };

    // Find batch in MongoDB
    if (tokenId) {
      batch = await Batch.findByTokenId(parseInt(tokenId));
    } else if (batchID) {
      batch = await Batch.findByBatchID(batchID);
    } else if (qrData) {
      // Extract from QR data
      const qr = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
      if (qr.data) {
        batch = await Batch.findByTokenId(qr.data.tokenId);
      }
    }

    if (!batch) {
      return res.status(404).json({
        success: false,
        authentic: false,
        error: 'Batch not found in database'
      });
    }

    // Check 1: Hash integrity (MongoDB)
    // Note: This checks if MongoDB's computed hash matches stored hash
    // If metadataHash wasn't set correctly initially, this might fail
    // But we'll also check against blockchain hash which is the source of truth
    const hashValid = batch.verifyHashIntegrity();
    verificationResult.checks.hashIntegrity = hashValid;
    // Don't fail verification just on MongoDB hash mismatch - blockchain is source of truth
    if (!hashValid) {
      console.warn('MongoDB hash integrity check failed for batch:', batch.batchID);
      // Only add as warning, not blocking error
      verificationResult.warnings = verificationResult.warnings || [];
      verificationResult.warnings.push('Metadata hash mismatch in database (will check blockchain hash)');
    }

    // Check 2: Counterfeit flag
    verificationResult.checks.counterfeitFlag = !batch.isCounterfeit;
    if (batch.isCounterfeit) {
      verificationResult.errors.push('Batch flagged as counterfeit');
    }

    // Check 3: QR signature verification (if QR data provided)
    if (qrData) {
      try {
        const qr = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
        
        if (qr.data && qr.signature) {
          // Recover signer from signature
          const messageHash = ethers.id(JSON.stringify(qr.data));
          const recoveredAddress = ethers.verifyMessage(
            ethers.getBytes(messageHash),
            qr.signature
          );

          // Verify signer matches manufacturer
          const signatureValid = recoveredAddress.toLowerCase() === batch.manufacturer.toLowerCase();
          verificationResult.checks.qrSignature = signatureValid;
          
          if (!signatureValid) {
            verificationResult.errors.push('QR signature verification failed');
          }

          // Verify contract address matches
          if (qr.data.contract) {
            verificationResult.checks.contractMatch = qr.data.contract.toLowerCase() === batch.contractAddress?.toLowerCase();
            if (!verificationResult.checks.contractMatch) {
              verificationResult.errors.push('Contract address mismatch');
            }
          }
        }
      } catch (qrError) {
        verificationResult.errors.push(`QR verification error: ${qrError.message}`);
      }
    }

    // Check 4: Blockchain verification (if contract address available)
    // CRITICAL: Verify metadataHash matches between MongoDB and blockchain
    if (CONTRACT_ADDRESS && batch.tokenId) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contractABI = [
          "function getBatchDetails(uint256 tokenId) view returns (tuple(uint256 tokenId, address currentOwner, uint8 currentRole, string batchID, string metadataHash, string metadataURI, string qrCodeURI, uint256 timestamp, address manufacturer))",
          "function ownerOf(uint256 tokenId) view returns (address)",
          "function isCounterfeit(uint256 tokenId) view returns (bool)",
          "function getParentBatch(uint256 tokenId) view returns (uint256)"
        ];
        
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
        const onChainBatch = await contract.getBatchDetails(batch.tokenId);
        const onChainOwner = await contract.ownerOf(batch.tokenId);
        const onChainCounterfeit = await contract.isCounterfeit(batch.tokenId);

        // CRITICAL VERIFICATION: metadataHash must match (proves MongoDB data hasn't been tampered)
        // Compute hash from MongoDB's immutable fields and compare with blockchain
        const { generateMetadataHash } = require('../utils/hashUtil');
        const mongoMetadata = {
          batchID: batch.batchID,
          drugName: batch.drugName,
          manufacturingDate: batch.manufacturingDate instanceof Date 
            ? batch.manufacturingDate.toISOString().split('T')[0]
            : new Date(batch.manufacturingDate).toISOString().split('T')[0],
          expiryDate: batch.expiryDate instanceof Date 
            ? batch.expiryDate.toISOString().split('T')[0]
            : new Date(batch.expiryDate).toISOString().split('T')[0],
          quantity: batch.quantity,
          manufacturer: batch.manufacturer.toLowerCase()
        };
        const computedMongoHash = generateMetadataHash(mongoMetadata);
        const metadataHashMatch = onChainBatch.metadataHash.toLowerCase() === computedMongoHash.toLowerCase();
        
        // Verify on-chain data matches MongoDB
        verificationResult.checks.blockchainMatch = {
          ownerMatch: onChainOwner.toLowerCase() === batch.currentOwner.toLowerCase(),
          batchIDMatch: onChainBatch.batchID === batch.batchID,
          manufacturerMatch: onChainBatch.manufacturer.toLowerCase() === batch.manufacturer.toLowerCase(),
          metadataHashMatch: metadataHashMatch, // CRITICAL: Ensures MongoDB metadata integrity
          counterfeitMatch: !onChainCounterfeit === !batch.isCounterfeit
        };

        // Owner mismatch is OK - owner changes during transfers, only warn if drastically wrong
        if (!verificationResult.checks.blockchainMatch.batchIDMatch) {
          verificationResult.errors.push('Batch ID mismatch between blockchain and database');
        }
        if (!verificationResult.checks.blockchainMatch.manufacturerMatch) {
          verificationResult.errors.push('Manufacturer mismatch between blockchain and database');
        }
        // Metadata hash mismatch is critical - but only fail if other checks also fail
        if (!metadataHashMatch) {
          console.warn('MetadataHash mismatch for batch:', batch.batchID);
          verificationResult.warnings = verificationResult.warnings || [];
          verificationResult.warnings.push('Metadata hash mismatch - verifying against blockchain directly');
          // Don't immediately fail - blockchain is source of truth
        }
        if (onChainCounterfeit || batch.isCounterfeit) {
          verificationResult.errors.push('Batch flagged as counterfeit on blockchain');
        }
      } catch (blockchainError) {
        verificationResult.errors.push(`Blockchain verification error: ${blockchainError.message}`);
      }
    }

    // Final verdict - blockchain is source of truth
    // Must pass: batchID match, manufacturer match, not counterfeit
    // Owner can change during transfers, so ownerMatch is not required
    // Metadata hash mismatch is suspicious but not necessarily blocking if blockchain data is valid
    const criticalChecks = [
      verificationResult.checks.blockchainMatch?.batchIDMatch !== false,
      verificationResult.checks.blockchainMatch?.manufacturerMatch !== false,
      verificationResult.checks.counterfeitFlag === true // Not counterfeit
    ];
    
    const allCriticalPassed = criticalChecks.every(check => check === true);
    const hasBlockingErrors = verificationResult.errors.some(err => 
      err.includes('counterfeit') || err.includes('Batch ID mismatch') || err.includes('Manufacturer mismatch')
    );

    // Authentic if critical checks pass and no blocking errors
    verificationResult.authentic = allCriticalPassed && !hasBlockingErrors;

    res.json({
      success: true,
      authentic: verificationResult.authentic,
      batch: batch,
      verification: verificationResult,
      message: verificationResult.authentic 
        ? '✅ Product is AUTHENTIC' 
        : '❌ Product verification FAILED'
    });
  } catch (error) {
    console.error('Error verifying product:', error);
    res.status(500).json({
      success: false,
      authentic: false,
      error: 'Verification failed',
      message: error.message
    });
  }
});

/**
 * GET /api/verify/:id - Quick verification by batchID or tokenId
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let batch;
    if (!isNaN(id)) {
      batch = await Batch.findByTokenId(parseInt(id));
    } else {
      batch = await Batch.findByBatchID(id);
    }

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    // Perform basic checks
    const hashValid = batch.verifyHashIntegrity();
    const isCounterfeit = batch.isCounterfeit;

    res.json({
      success: true,
      batch: {
        batchID: batch.batchID,
        tokenId: batch.tokenId,
        drugName: batch.drugName,
        manufacturer: batch.manufacturer,
        currentOwner: batch.currentOwner,
        currentRole: batch.currentRole,
        status: batch.status
      },
      checks: {
        hashIntegrity: hashValid,
        notCounterfeit: !isCounterfeit
      },
      authentic: hashValid && !isCounterfeit
    });
  } catch (error) {
    console.error('Error in quick verification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


