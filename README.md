# Blockchain-based Pharmaceutical Supply Chain Tracker

A comprehensive blockchain solution for tracking pharmaceutical products through the supply chain using NFTs, QR codes, and cryptographic verification.

## 🏗️ Architecture

### Tech Stack
- **Blockchain**: Polygon (Amoy Testnet)
- **Smart Contracts**: Solidity + Hardhat
- **Frontend**: React + Ethers.js
- **Storage**: IPFS for metadata and documents
- **Authentication**: MetaMask wallet integration
- **QR Codes**: Digital signing with cryptographic verification

### Key Features
- ✅ **Role-based Access Control**: Manufacturer, Distributor, Retailer, Pharmacy
- ✅ **NFT-based Batch Tracking**: Each pharmaceutical batch is an NFT
- ✅ **QR Code Generation**: Cryptographically signed QR codes
- ✅ **Supply Chain Verification**: Complete ownership trail
- ✅ **Parent-Child Batch Linking**: Support for sub-batches
- ✅ **Consumer Verification**: QR code scanning and authenticity verification

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MetaMask wallet
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd pharma-supply-chain
```

2. **Install dependencies**
```bash
npm install
cd frontend
npm install
cd ..
```

3. **Environment Setup**
```bash
cp env.example .env
# Edit .env with your private key and API keys
```

4. **Deploy Smart Contract**
```bash
# Compile contracts
npx hardhat compile

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deployAmoy.js --network amoy
```

5. **Update Frontend Configuration**
```bash
# Update CONTRACT_ADDRESS in frontend/src/App.js
# Update CONTRACT_ABI in frontend/src/App.js
```

6. **Start Frontend**
```bash
cd frontend
npm start
```

## 📋 Usage Guide

### For Manufacturers
1. **Register as Manufacturer**: Contract owner must register your address
2. **Create Batch**: Mint NFT for new pharmaceutical batch
3. **Generate QR Code**: Create cryptographically signed QR code
4. **Link Batches**: Connect parent-child batch relationships

### For Distributors/Retailers/Pharmacies
1. **Receive Batches**: Accept transfers from previous role
2. **Verify Authenticity**: Verify batch ownership and history
3. **Transfer Forward**: Pass to next role in supply chain

### For Consumers
1. **Scan QR Code**: Use mobile device to scan product QR code
2. **Verify Authenticity**: System validates signature and blockchain data
3. **View History**: See complete supply chain trail

## 🔐 Security Features

### Cryptographic Verification
- **Digital Signatures**: QR codes signed with manufacturer's private key
- **Blockchain Validation**: On-chain data verification
- **Tamper Detection**: Any modification invalidates the QR code

### Access Control
- **Role-based Permissions**: Each role has specific capabilities
- **Transfer Validation**: Enforced supply chain sequence
- **Manufacturer Registration**: Only verified manufacturers can mint

## 🧪 Testing

### Smart Contract Tests
```bash
npx hardhat test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### End-to-End Testing
1. Deploy contract to testnet
2. Create test batches
3. Generate QR codes
4. Test verification flow

## 📊 Contract Functions

### Core Functions
- `mintBatch()`: Create new pharmaceutical batch NFT
- `transferBatch()`: Transfer ownership to next role
- `verifyBatch()`: Verify batch authenticity
- `linkChildBatch()`: Link parent-child batch relationships

### Role Management
- `registerManufacturer()`: Register new manufacturer
- `setRole()`: Assign roles to addresses
- `getRole()`: Check user role

### Query Functions
- `getBatchDetails()`: Get batch information
- `getTransferHistory()`: View ownership trail
- `getChildBatches()`: Get linked child batches

## 🌐 Deployment

### Polygon Amoy Testnet
- **Network**: Polygon Amoy Testnet
- **Chain ID**: 80002
- **RPC URL**: https://rpc-amoy.polygon.technology
- **Explorer**: https://amoy.polygonscan.com

### Production Deployment
1. Deploy to Polygon Mainnet
2. Update frontend configuration
3. Set up IPFS pinning service
4. Configure domain and SSL

## 🔧 Configuration

### Environment Variables
```bash
PRIVATE_KEY=your_private_key
POLYGONSCAN_API_KEY=your_api_key
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
```

### Frontend Configuration
Update `frontend/src/App.js`:
```javascript
const CONTRACT_ADDRESS = "0x..."; // Your deployed contract address
const CONTRACT_ABI = [...]; // Contract ABI from artifacts
```

## 📈 Roadmap

### Phase 1: Core Functionality ✅
- [x] Smart contract development
- [x] Basic frontend interface
- [x] QR code generation
- [x] Verification system

### Phase 2: Enhanced Features
- [ ] IPFS integration for document storage
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] API for third-party integration

### Phase 3: Production Features
- [ ] Multi-language support
- [ ] Advanced reporting
- [ ] Integration with existing systems
- [ ] Compliance and audit features

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔗 Links

- [Polygon Documentation](https://docs.polygon.technology/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [React Documentation](https://reactjs.org/docs/)
