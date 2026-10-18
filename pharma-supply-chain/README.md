# PharmaTrust: Decentralized Pharmaceutical Supply Chain Provenance & Anti-Counterfeiting Platform

[![Polygon Amoy](https://img.shields.io/badge/Network-Polygon_Amoy_Testnet-8247E5?logo=polygon&logoColor=white)](https://amoy.polygonscan.com/address/0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c)
[![Solidity](https://img.shields.io/badge/Solidity-v0.8.20-363636?logo=solidity&logoColor=white)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![IPFS](https://img.shields.io/badge/Storage-IPFS_Pinata-65C2CB?logo=ipfs&logoColor=white)](https://ipfs.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **B.Tech Final Year Project — Review-IV (CA-4) Submission**  
> **Department of Computer Science & Engineering**  
> **Symbiosis Institute of Technology (SIT), Pune**  
> *A Constituent of Symbiosis International (Deemed University)*

---

## 👥 Project Team & Academic Credits

| Role | Name | PRN / Affiliation |
| :--- | :--- | :--- |
| **Student 1** | **Sukaran Singh** | `23070122213` (B.Tech CSE, SIT Pune) |
| **Student 2** | **Shreyash Sure** | `23070122214` (B.Tech CSE, SIT Pune) |
| **Project Guide & Coordinator** | **Dr. Ranjeet Bidwe** | Dept. of Computer Science & Engineering, SIT Pune |

---

## 📚 Final Review-IV Deliverables

The complete B.Tech Black Book Report and Academic Presentation Poster are available in the repository:

* 📄 **Black Book Report (Ready-to-Print PDF — 47 Pages):** [`docs/deliverables/PharmaTrust_BlackBook_Report.pdf`](docs/deliverables/PharmaTrust_BlackBook_Report.pdf)
* 📝 **Black Book Report (Editable Word Document):** [`docs/deliverables/PharmaTrust_BlackBook_Report.docx`](docs/deliverables/PharmaTrust_BlackBook_Report.docx)
* 🎨 **Academic Project Poster (High-Resolution Vector PDF):** [`docs/deliverables/PharmaTrust_Academic_Poster.pdf`](docs/deliverables/PharmaTrust_Academic_Poster.pdf)
* 📊 **Academic Project Poster (Editable Presentation PPTX):** [`docs/deliverables/PharmaTrust_Academic_Poster.pptx`](docs/deliverables/PharmaTrust_Academic_Poster.pptx)
* 🖼️ **System Diagrams & Benchmarks:** Available in [`docs/diagrams/`](docs/diagrams/)

---

## 🌐 On-Chain Deployment Details

* **Network:** Polygon Amoy PoS Testnet
* **Chain ID:** `80002`
* **RPC Gateway:** `https://rpc-amoy.polygon.technology`
* **Smart Contract Address:** [`0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c`](https://amoy.polygonscan.com/address/0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c)
* **Contract Specification:** `PharmaSupplyChainCompatible.sol` (OpenZeppelin ERC-721 + AccessControl)
* **Demo Stakeholder Wallets:**
  * **Manufacturer:** `0x093F8CA5f70Dd1dbC39Df1A30F2F0D8Ab05B8510` (Sun Pharma Industries Ltd.)
  * **Distributor:** `0x6D9149Ca7E04FDAE6c2b880d4C22d1e834e436b5` (MediLink Distribution Pvt. Ltd.)
  * **Retailer:** `0xA514337cbcc4149952220A23487eF961E748Ce8C` (Apollo Pharmacy)
  * **Pharmacy:** `0x02d61482CAB7847e8E46D68C58e2601a8c2D589c` (Local Care Pharmacy)

---

## 🏗️ System Architecture & Workflow

PharmaTrust replaces centralized, siloed supply chain databases with a high-throughput, non-custodial decentralized platform:

```
[ Drug Manufacturer ] 
       │  (1) Mints ERC-721 Batch Token + Uploads Formulation to IPFS
       ▼
[ Polygon Amoy Smart Contract (0x2C56C...ee11c) ]
       │  (2) Multi-Hop Role-Guarded Custody Transfers
       ├──────────────────────────────────────────────┐
       ▼                                              ▼
[ Wholesale Distributor ]                      [ Quality Regulator ]
       │  (3) Verified In-Transit Transfer            │ (Freeze/Flag)
       ▼                                              ▼
[ Retail Pharmacy ]                            [ flagCounterfeit() ]
       │  (4) Physical Dispensing + Dynamic QR
       ▼
[ End-Consumer Smartphone ] ──(Zero-Gas eth_call)──▶ [ Instant Provenance Audit ]
```

### Key Technical Innovations
1. **Parent-Child Hierarchical Tokenization:** Enables master wholesale consignments and linked unit blister packs to be transferred atomically in a single blockchain transaction, slashing gas costs by over 60%.
2. **Zero-Gas Public Verification:** End patients scan dynamic QR codes using any standard smartphone camera. The client evaluates `getBatchDetails()` using read-only JSON-RPC calls (`eth_call`), requiring zero cryptocurrency or Web3 wallet extensions.
3. **Deterministic State Machine:** Custody handoffs are strictly enforced by smart contract modifiers (`Manufacturer` $\rightarrow$ `Distributor` $\rightarrow$ `Retailer` $\rightarrow$ `Pharmacy`).
4. **Hybrid Persistence Resilience:** Node.js/Express middleware syncs on-chain event logs to MongoDB Atlas while incorporating a non-blocking fallback (`global.mongoAvailable`), ensuring continuous operation even during database maintenance.

---

## ⚡ Empirical Performance & Gas Benchmarks

| Operation | Gas Units Used | Avg POL Cost | Avg USD Cost ($0.06/POL) | Execution Latency |
| :--- | :--- | :--- | :--- | :--- |
| **`createBatch()` [Minting]** | 184,441 | 0.00553 POL | **$0.000331** | 2.14 s (1 block) |
| **`transferBatch()` [Handoff]** | 77,917 | 0.00233 POL | **$0.000140** | 2.08 s (1 block) |
| **Bulk Transfer (5 Children)** | 245,100 | 0.00735 POL | **$0.000441** | 2.35 s (1 block) |
| **`flagCounterfeit()` [Freeze]** | 46,200 | 0.00138 POL | **$0.000083** | 2.02 s (1 block) |
| **`getBatchDetails()` [Verify]** | **0 (Read-Only)**| **0.00000 POL**| **FREE ($0.00)** | **0.54 s (RPC Query)** |

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
* Node.js v18 or v20 LTS
* MetaMask Browser Extension configured for **Polygon Amoy Testnet** (RPC: `https://rpc-amoy.polygon.technology`, Chain ID: `80002`, Symbol: `POL`)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sukaransingh123/btech-final-project.git
cd btech-final-project/btech-pharma-blockchain/pharma-supply-chain

# Install backend dependencies
cd backend && npm install
cd ..

# Install frontend dependencies
cd frontend && npm install
cd ..
```

### 3. Environment Configuration
Create an environment file at the root or review `env.example`:
```env
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
CONTRACT_ADDRESS=0x2C56C3107EE29eaE4A486C6c1244bCbb3E2Ee11c
MONGODB_URI=mongodb+srv://<user>:<password>@pharma-cluster.kmrmhyi.mongodb.net/pharma-supply-chain
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
```

### 4. Running the Platform
```bash
# Terminal 1: Start Backend API & Event Sync
cd backend && npm run dev

# Terminal 2: Start React Web3 Application
cd frontend && npm start
```
Open [http://localhost:3000](http://localhost:3000) to access the PharmaTrust platform.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.