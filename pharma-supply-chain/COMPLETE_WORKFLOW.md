# 🔷 Complete Project Workflow - MongoDB + Blockchain Integration

## ✅ Architecture Overview

```
┌─────────────────┐
│  React Frontend │
│   (Ethers.js)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌──────────────┐
│ MongoDB │  │ Smart Contract│
│ Backend │  │   (Polygon)   │
└────┬────┘  └──────┬───────┘
     │              │
     │              │ Events
     └──────┬───────┘
            │
     ┌──────▼──────┐
     │   Sync via  │
     │   Listener  │
     └─────────────┘
```

## 🔄 Complete Workflow

### Phase 1: Batch Creation (Manufacturer)

**Flow:**
1. Frontend (CreateBatch.js) → Store metadata in MongoDB → Get mongoRef
2. Frontend → Mint NFT on blockchain (using Ethers.js)
3. Blockchain emits `BatchMinted` event
4. MongoDB listener catches event → Updates batch with tokenId

**Code Flow:**
```javascript
// Frontend
1. apiService.createBatch(batchData, qaFile) → MongoDB
2. contract.mintBatch(tokenURI, batchID) → Blockchain
3. Event: BatchMinted(tokenId, owner, batchID)
4. Listener: Updates MongoDB with tokenId
```

### Phase 2: QR Code Generation

**Flow:**
1. Manufacturer generates QR code (frontend signs with MetaMask)
2. QR data stored in MongoDB (optional)
3. QR contains: batchId, tokenId, contract, signature

**Code Flow:**
```javascript
// Frontend (GenerateQR.js)
1. Sign payload with MetaMask
2. Create QR code image
3. Optionally: apiService.storeQRData() → MongoDB
```

### Phase 3: Transfer Flow

**Flow:**
1. Frontend (TransferBatch.js) → Transfer on blockchain
2. Blockchain emits `OwnershipTransferred` event
3. MongoDB listener catches event → Auto-updates ownership in DB

**Code Flow:**
```javascript
// Frontend
1. contract.transferBatch(tokenId, newOwner) → Blockchain
2. Event: OwnershipTransferred(tokenId, from, to, role)
3. Listener: Updates MongoDB history and currentOwner
```

### Phase 4: Verification

**Flow:**
1. Consumer scans QR code
2. Frontend (VerifyBatch.js) → Tries MongoDB API first (rich data)
3. Falls back to blockchain-only if MongoDB unavailable
4. Verifies signature, checks blockchain state

**Code Flow:**
```javascript
// Frontend
1. Try: apiService.verifyProduct(qrData) → MongoDB + Blockchain check
2. Fallback: Direct blockchain verification if MongoDB unavailable
3. Display result
```

## 📝 Key Fixes Applied

### 1. MongoDB Model - tokenId Now Optional
- Changed `tokenId` from `required: true` to `required: false`
- Added `sparse: true` for unique index (allows null values)
- Batch can be created before NFT mint, tokenId added later

### 2. Frontend Crypto Fix
- Removed `require('crypto')` (Node.js only)
- Uses browser `crypto.subtle.digest('SHA-256')` API
- Works in browser environment

### 3. Event Listener Enhancement
- Better handling of BatchMinted events
- Finds batch by batchID first (created before mint)
- Auto-creates batch entry if missing (with on-chain data)
- Updates tokenId when mint completes

### 4. Hybrid Architecture
- Frontend works with OR without MongoDB
- MongoDB is optional enhancement layer
- Blockchain remains source of truth
- All operations work in blockchain-only mode

## 🔒 Security & Data Integrity

### Blockchain (Source of Truth)
- ✅ NFT ownership
- ✅ Transfer history
- ✅ Role assignments
- ✅ Counterfeit flags
- ✅ Scan records

### MongoDB (Rich Data Layer)
- ✅ Metadata (drug name, dates, quantity)
- ✅ QA certificates (files)
- ✅ QR signatures
- ✅ Analytics data
- ✅ Fast queries

### Hash Verification
- Metadata hash stored in MongoDB
- Can be verified against blockchain commitment
- Detects tampering in off-chain data

## 🚀 Deployment Checklist

### 1. Smart Contract
```bash
npx hardhat run scripts/deployAmoy.js --network amoy
```

### 2. MongoDB Setup
```bash
# Install MongoDB locally or use Atlas
# Update MONGODB_URI in env file
```

### 3. Backend Server
```bash
cd backend
npm install
npm start
# Listens on port 5000
```

### 4. Frontend
```bash
cd frontend
npm install
# Set REACT_APP_API_URL=http://localhost:5000/api in .env
npm start
```

## 📊 API Endpoints

### Backend (Port 5000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/batches` | POST | Create batch |
| `/api/batches/:id` | GET | Get batch |
| `/api/batches/:id` | PUT | Update batch |
| `/api/batches/:id/transfer` | POST | Record transfer |
| `/api/verify` | POST | Verify product |
| `/api/metadata/:id` | GET | Get metadata |
| `/api/qr` | POST | Store QR data |

## ✅ Consistency Checks

- ✅ Smart contract functions match frontend calls
- ✅ MongoDB schema matches API responses
- ✅ Event listener handles all contract events
- ✅ Frontend gracefully handles MongoDB absence
- ✅ Hash generation consistent (SHA-256)
- ✅ Role mapping consistent across layers
- ✅ Error handling in all components


