const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const { generateMetadataHash } = require('../utils/hashUtil');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'qa-certificates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .pdf, .jpg, .jpeg, .png files are allowed'));
  }
});

/**
 * POST /api/batches - Create a new batch (called by manufacturer)
 */
router.post('/', upload.single('qaCertificate'), async (req, res) => {
  try {
    const {
      batchID,
      drugName,
      manufacturingDate,
      expiryDate,
      quantity,
      manufacturer,
      manufacturerName,
      tokenId,
      contractAddress,
      metadataHash,
      mongoRef
    } = req.body;

    // Validate required fields
    if (!batchID || !drugName || !manufacturingDate || !expiryDate || !manufacturer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if batch already exists (handle duplicates gracefully)
    let batch = await Batch.findByBatchID(batchID);
    
    if (batch) {
      // Batch exists - update it with new data if provided (e.g., tokenId from mint)
      const updates = {};
      
      if (tokenId && (!batch.tokenId || batch.tokenId !== parseInt(tokenId))) {
        updates.tokenId = parseInt(tokenId);
      }
      
      if (contractAddress && batch.contractAddress !== contractAddress) {
        updates.contractAddress = contractAddress;
      }
      
      if (metadataHash && batch.metadataHash !== metadataHash) {
        updates.metadataHash = metadataHash;
      }
      
      // Update QA certificate if provided
      if (req.file) {
        const qaCertificateUrl = `/uploads/qa-certificates/${req.file.filename}`;
        const fileBuffer = fs.readFileSync(req.file.path);
        const qaCertificateHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        updates.qaCertificateUrl = qaCertificateUrl;
        updates.qaCertificateHash = qaCertificateHash;
      }
      
      if (Object.keys(updates).length > 0) {
        Object.assign(batch, updates);
        await batch.save();
      }
      
      return res.status(200).json({
        success: true,
        batch: batch,
        message: 'Batch already exists, updated with new data'
      });
    }

    // Generate metadata hash if not provided
    const computedMetadataHash = metadataHash || generateMetadataHash({
      batchID,
      drugName,
      manufacturingDate,
      expiryDate,
      quantity: quantity || 1,
      manufacturer
    });

    // Handle QA certificate upload
    let qaCertificateUrl = null;
    let qaCertificateHash = null;
    
    if (req.file) {
      qaCertificateUrl = `/uploads/qa-certificates/${req.file.filename}`;
      const fileBuffer = fs.readFileSync(req.file.path);
      qaCertificateHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    // Create batch document
    const batchData = {
      batchID,
      drugName,
      manufacturingDate: new Date(manufacturingDate),
      expiryDate: new Date(expiryDate),
      quantity: parseInt(quantity) || 1,
      manufacturer: manufacturer.toLowerCase(),
      manufacturerName: manufacturerName || '',
      currentOwner: manufacturer.toLowerCase(),
      currentRole: 'Manufacturer',
      metadataHash: computedMetadataHash,
      qaCertificateHash,
      qaCertificateUrl,
      mongoRef: mongoRef || new mongoose.Types.ObjectId().toString(),
      status: 'Created',
      contractAddress: contractAddress || '0x0000000000000000000000000000000000000000'
    };

    // Add tokenId if provided (after NFT mint) - otherwise will be set by event listener
    if (tokenId) {
      batchData.tokenId = parseInt(tokenId);
    }

    batch = new Batch(batchData);
    await batch.save();

    res.status(201).json({
      success: true,
      batch: batch,
      message: 'Batch created successfully'
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    
    // Handle duplicate key errors (secondary check in case of race condition)
    if (error.code === 11000) {
      // Try to find and return existing batch
      try {
        const existingBatch = await Batch.findByBatchID(batchID);
        if (existingBatch) {
          return res.status(200).json({
            success: true,
            batch: existingBatch,
            message: 'Batch already exists'
          });
        }
      } catch (findError) {
        // If we can't find it, return error
      }
      
      return res.status(400).json({ 
        error: 'Batch ID or Token ID already exists',
        field: Object.keys(error.keyPattern)[0]
      });
    }
    
    res.status(500).json({ error: 'Failed to create batch', message: error.message });
  }
});

/**
 * GET /api/batches - Get all batches (with optional filters)
 */
router.get('/', async (req, res) => {
  try {
    const { owner, manufacturer, status, role } = req.query;
    const query = {};

    if (owner) {
      query.currentOwner = owner.toLowerCase();
    }
    if (manufacturer) {
      query.manufacturer = manufacturer.toLowerCase();
    }
    if (status) {
      query.status = status;
    }
    if (role) {
      query.currentRole = role;
    }

    const batches = await Batch.find(query).sort({ createdAt: -1 });
    res.json({ success: true, batches, count: batches.length });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches', message: error.message });
  }
});

/**
 * GET /api/batches/:id - Get batch by ID (tokenId or batchID)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by tokenId first (if numeric), then by batchID
    let batch;
    if (!isNaN(id)) {
      batch = await Batch.findByTokenId(parseInt(id));
    }
    
    if (!batch) {
      batch = await Batch.findByBatchID(id);
    }

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json({ success: true, batch });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch', message: error.message });
  }
});

/**
 * PUT /api/batches/:id - Update batch (e.g., after transfer)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    let batch;
    if (!isNaN(id)) {
      batch = await Batch.findByTokenId(parseInt(id));
    } else {
      batch = await Batch.findByBatchID(id);
    }

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'currentOwner', 'currentRole', 'status', 'qrSignature', 'qrData',
      'isCounterfeit', 'metadataURI'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        batch[field] = updates[field];
      }
    });

    batch.updatedAt = new Date();
    await batch.save();

    res.json({ success: true, batch, message: 'Batch updated successfully' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Failed to update batch', message: error.message });
  }
});

/**
 * POST /api/batches/:id/transfer - Record a transfer
 */
router.post('/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, fromRole, toRole, txHash } = req.body;

    if (!from || !to || !fromRole || !toRole) {
      return res.status(400).json({ error: 'Missing transfer details' });
    }

    let batch;
    if (!isNaN(id)) {
      batch = await Batch.findByTokenId(parseInt(id));
    } else {
      batch = await Batch.findByBatchID(id);
    }

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Add transfer to history
    batch.history.push({
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      fromRole,
      toRole,
      timestamp: new Date(),
      txHash: txHash || null
    });

    // Update current owner and role
    batch.currentOwner = to.toLowerCase();
    batch.currentRole = toRole;
    batch.status = toRole === 'Pharmacy' ? 'Delivered' : 'InTransit';
    batch.updatedAt = new Date();

    await batch.save();

    res.json({ 
      success: true, 
      batch, 
      message: 'Transfer recorded successfully' 
    });
  } catch (error) {
    console.error('Error recording transfer:', error);
    res.status(500).json({ error: 'Failed to record transfer', message: error.message });
  }
});

/**
 * GET /api/batches/:id/history - Get transfer history
 */
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    
    let batch;
    if (!isNaN(id)) {
      batch = await Batch.findByTokenId(parseInt(id));
    } else {
      batch = await Batch.findByBatchID(id);
    }

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json({ success: true, history: batch.history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history', message: error.message });
  }
});

module.exports = router;

