# MongoDB Integration Guide - Hybrid Architecture

## 🎯 Architecture Overview

**Current Setup:**
- ✅ Frontend (React) → Ethers.js → Smart Contract (Direct connection)
- ✅ Smart Contract on Polygon Amoy

**New Addition:**
- ✅ MongoDB Backend (Optional/Sync layer)

## 📊 How It Works

```
┌─────────────┐
│  Frontend   │
│  (React)    │
└──────┬──────┘
       │
       ├── Ethers.js ──────────┐
       │                        │
       │                        ▼
       │              ┌──────────────────┐
       │              │ Smart Contract   │
       │              │  (Blockchain)    │
       │              └────────┬─────────┘
       │                        │
       │                        │ Events
       │                        ▼
       │              ┌──────────────────┐
       └─────────────►│ MongoDB Backend  │
         API Calls    │  (Sync Layer)    │
                      └──────────────────┘
```

## 🔄 Data Flow

### 1. **Batch Creation Flow**

```
Frontend (CreateBatch.js)
  ├─> Step 1: Call MongoDB API → Store metadata + Generate hash
  ├─> Step 2: Mint NFT on blockchain (with metadataHash)
  └─> Step 3: MongoDB listener detects BatchMinted event → Updates with tokenId
```

### 2. **Transfer Flow**

```
Frontend (TransferBatch.js)
  ├─> Step 1: Transfer on blockchain (Ethers.js)
  └─> Step 2: MongoDB listener detects OwnershipTransferred → Auto-updates DB
```

### 3. **Verification Flow**

```
Frontend (VerifyBatch.js)
  ├─> Option A: Query MongoDB API → Get rich metadata + history
  └─> Option B: Query blockchain directly → Get on-chain data
```

## ✅ Benefits

1. **Blockchain Remains Source of Truth** - All critical operations happen on-chain
2. **MongoDB for Rich Data** - Store files, images, detailed metadata
3. **Fast Queries** - MongoDB for analytics without blockchain delays
4. **Automatic Sync** - Backend listens to events and syncs automatically
5. **Backward Compatible** - Frontend still works without MongoDB

## 🚀 Setup Instructions

### Step 1: Install MongoDB Backend Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment

Update `env` file:
```bash
MONGODB_URI=mongodb://localhost:27017/pharma-supply-chain
CONTRACT_ADDRESS=0xYourDeployedContractAddress
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

### Step 3: Start MongoDB Backend

```bash
cd backend
npm start
# or for development
npm run dev
```

### Step 4: Update Frontend Environment

Add to `frontend/.env`:
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

## 📝 Integration Points

### Frontend Components Updated:

1. **CreateBatch.js** - Creates in MongoDB first, then mints NFT
2. **TransferBatch.js** - Optionally syncs transfer to MongoDB
3. **VerifyBatch.js** - Can query MongoDB for rich verification data

### MongoDB Backend Features:

1. **Blockchain Event Listener** - Auto-syncs from blockchain events
2. **API Endpoints** - REST API for frontend queries
3. **File Storage** - QA certificates, images
4. **Hash Verification** - Metadata integrity checks

## 🔒 Security Note

- **Blockchain is always source of truth**
- MongoDB is for convenience and rich data only
- All critical operations (minting, transfers) happen on-chain
- MongoDB syncs FROM blockchain, never the reverse


