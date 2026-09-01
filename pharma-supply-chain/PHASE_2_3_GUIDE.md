# Phase 2 & 3 — Local demo

The newer `PharmaSupplyChain.sol` contract is used by the Phase 2 bridge and the
public Phase 3 tracker. It is intentionally separate from the pre-existing NFT
screens so both implementations remain usable.

## Start the demo

1. In terminal one, start the local blockchain:

   ```bash
   npx hardhat node
   ```

2. In terminal two, deploy the lifecycle contract and copy the printed address
   into `SUPPLY_CHAIN_CONTRACT_ADDRESS` in `env` and
   `REACT_APP_SUPPLY_CHAIN_CONTRACT_ADDRESS` in `frontend/.env`:

   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

3. Start the backend (it reads `SUPPLY_CHAIN_RPC_URL` and the contract address):

   ```bash
   cd backend && npm start
   ```

4. In terminal three, launch the UI:

   ```bash
   cd frontend && npm start
   ```

Open `/supply-chain-tracker` and enter the numeric batch ID. The page shows the
origin, manufacturing, distributor, pharmacy, consumer handoffs, timestamps,
and the latest tamper-proof on-chain hash.

## Security model

Each transfer payload is signed with the stakeholder's Ethereum key using
ECDSA/EIP-191. `SupplyChainService.updateBatchStage()` verifies the recovered
signer before writing to the contract. The contract independently enforces the
stakeholder role and valid lifecycle order. The backend never accepts or stores
a stakeholder's private key.

Run the complete automated lifecycle and invalid-signature checks with:

```bash
npm run test:phase2
```
