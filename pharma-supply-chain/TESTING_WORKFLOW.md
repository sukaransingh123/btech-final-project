# Complete End-to-End Testing Workflow Guide

## 📋 Prerequisites

### 1. MetaMask Setup
- Install MetaMask browser extension
- Create or import test accounts
- Add Polygon Amoy Testnet network

### 2. Network Configuration (Polygon Amoy)
```
Network Name: Polygon Amoy Testnet
RPC URL: https://rpc-amoy.polygon.technology
Chain ID: 80002
Currency Symbol: MATIC
Block Explorer: https://amoy.polygonscan.com
```

### 3. Test Accounts (from your env file)
You should have these accounts configured:
- **Owner**: `0xA91066f1782a0413e7797e3F046D6E1C96f48d87`
- **Manufacturer**: `0x6c45a0ea03e5719a4a8d5fb2c2a7ed4d59ea2267`
- **Distributor**: `0x9236b51387c167a3D2fE14BdA6bc7517FD0C74C5`
- **Retailer**: `0x1d22d371e231E6ccA714CF3a4163a655D5914C02`
- **Pharmacy**: `0x1Cd0d720301FB3e420eB65bC63740fbEED5f4C83`

### 4. Get Test MATIC
- Visit Polygon Amoy Faucet: https://faucet.polygon.technology/
- Request test MATIC for your accounts
- Ensure each account has at least 0.1 MATIC

---

## 🚀 Step 1: Start the Application

### Start Backend Server
```bash
cd C:\Users\marya\pharma\btechproject\pharma-supply-chain\backend
npm start
```
**Expected**: Server running on `http://localhost:5000`
**Verify**: Visit `http://localhost:5000/api/health` - should return `{"status":"ok","database":"Connected"}`

### Start Frontend Server
```bash
cd C:\Users\marya\pharma\btechproject\pharma-supply-chain\frontend
npm start
```
**Expected**: React app opens at `http://localhost:3000`
**Verify**: You should see the PharmaTrust dashboard

---

## 👤 Step 2: Connect as Manufacturer

1. **Open Application**: Navigate to `http://localhost:3000`
2. **Connect MetaMask**:
   - Click "Connect Wallet" button
   - Select your Manufacturer account: `0x6c45a0ea03e5719a4a8d5fb2c2a7ed4d59ea2267`
   - Approve connection
3. **Verify Connection**:
   - Should see "Manufacturer" role displayed
   - Should see account address in header
   - Should see "Polygon Amoy" network indicator

---

## 📦 Step 3: Create a Batch (Manufacturer)

1. **Navigate to Create Batch**:
   - Click "Create Batch" in navigation
   - Or go to: `http://localhost:3000/create-batch`

2. **Fill Batch Details**:
   ```
   Batch ID: TEST-BATCH-001
   Drug Name: Paracetamol 500mg
   Manufacturing Date: (today's date)
   Expiry Date: (2 years from today)
   Manufacturer Name: Test Pharma Ltd
   Manufacturer Location: Mumbai, India
   Quantity: 1000
   ```

3. **Upload QA Certificate** (Optional):
   - Click "Choose File"
   - Select any PDF/image file
   - File will be uploaded to IPFS (mock)

4. **Submit Batch**:
   - Click "Create Batch" button
   - Confirm MetaMask transaction
   - Wait for transaction confirmation

5. **Verify Batch Created**:
   - Should see success message
   - Batch should appear in "My Batches" section
   - Note the Token ID (e.g., 1, 2, 3...)

---

## 🎯 Step 4: Generate QR Code (Manufacturer)

1. **Navigate to Generate QR**:
   - Click "Generate QR" in navigation
   - Or go to: `http://localhost:3000/generate-qr`

2. **Select Batch**:
   - Dropdown should show your created batches
   - Select the batch you just created (e.g., TEST-BATCH-001)

3. **Generate Parent QR Code**:
   - Click "Generate QR Code" button
   - **MetaMask will prompt for signature**:
     - This is the cryptographic signing step
     - Click "Sign" to approve
     - This creates the manufacturer's signature on the QR payload

4. **QR Code Displayed**:
   - QR code image appears
   - Contains: `batchId`, `tokenId`, `contract`, `signature`, `signer`
   - QR code is a URL: `http://localhost:3000/verify?data=base64encoded`

5. **Download/Save QR Code**:
   - Click "Download QR Code" to save image
   - Or take a screenshot
   - **IMPORTANT**: Save this QR code for testing

6. **Verify QR Data** (Optional):
   - Click "Copy QR Data" to see the JSON structure
   - Should contain:
     ```json
     {
       "data": {
         "type": "parent",
         "batchId": "TEST-BATCH-001",
         "tokenId": "1",
         "contract": "0xd36e5c231DB89afe06Ff740b958e918618EcE058",
         "signature": "0x...",
         "signer": "0x6c45a0ea03e5719a4a8d5fb2c2a7ed4d59ea2267"
       }
     }
     ```

---

## 📱 Step 5: Test QR Code Scanning

### Option A: Scan with Camera (Recommended)

1. **Navigate to Verify Page**:
   - Click "Verify" in navigation
   - Or go to: `http://localhost:3000/verify-batch`

2. **Open QR Scanner**:
   - Click "Scan QR Code" button
   - **Browser will ask for camera permission**:
     - Click "Allow" to grant camera access
     - If denied, you'll see error message

3. **Scan the QR Code**:
   - Point camera at the QR code you generated
   - Keep QR code within the scanning frame
   - Ensure good lighting
   - Wait for detection (usually 1-2 seconds)

4. **Expected Behavior**:
   - Scanner automatically closes when QR detected
   - QR data appears in the input field
   - Verification starts automatically

### Option B: Manual Paste (Fallback)

1. **If Camera Doesn't Work**:
   - Click "Paste" or manually enter QR data
   - Paste the JSON from "Copy QR Data" step
   - Click "Verify Product"

---

## ✅ Step 6: Verify Product Authenticity

1. **Verification Process** (Automatic after scan):
   - Backend verifies:
     - ✅ MongoDB hash integrity
     - ✅ Counterfeit flag check
     - ✅ QR signature verification (manufacturer signature)
     - ✅ Contract address match
     - ✅ Blockchain cross-check

2. **Expected Results**:
   ```
   ✅ Product is AUTHENTIC
   
   Product Details:
   - Batch ID: TEST-BATCH-001
   - Drug Name: Paracetamol 500mg
   - Manufacturer: Test Pharma Ltd
   - Manufacturing Date: [date]
   - Expiry Date: [date]
   
   Verification Checks:
   ✅ Hash Integrity: Valid
   ✅ Counterfeit Flag: Not flagged
   ✅ QR Signature: Valid (signed by manufacturer)
   ✅ Contract Match: Valid
   ✅ Blockchain Match: Valid
   ```

3. **Supply Chain History**:
   - Should show transfer history
   - Current owner: Manufacturer
   - Current role: Manufacturer

---

## 🔄 Step 7: Test Transfer Workflow

### Transfer to Distributor

1. **Switch to Distributor Account**:
   - Disconnect current wallet
   - Connect as Distributor: `0x9236b51387c167a3D2fE14BdA6bc7517FD0C74C5`

2. **Manufacturer Transfers Batch**:
   - Switch back to Manufacturer account
   - Go to "My Batches" or Dashboard
   - Find your batch
   - Click "Transfer Batch"
   - Enter Distributor address: `0x9236b51387c167a3D2fE14BdA6bc7517FD0C74C5`
   - Confirm MetaMask transaction

3. **Distributor Scans QR**:
   - Switch to Distributor account
   - Go to Verify page
   - Scan the same QR code
   - **Expected**: 
     - ✅ Product verified as authentic
     - ✅ Scan recorded on blockchain
     - ✅ Current owner shows Distributor

4. **Test Wrong Role Scan** (Security Test):
   - While logged in as Distributor, scan the QR again
   - **Expected**: 
     - ❌ Error: "Repeated scan detected"
     - ❌ Batch marked as counterfeit
     - This tests the security feature

---

## 🧪 Step 8: Test Edge Cases

### Test 1: Invalid QR Code
1. Generate a fake QR code or modify the data
2. Try to verify
3. **Expected**: ❌ Verification fails with error

### Test 2: Camera Permission Denied
1. Deny camera permission when prompted
2. **Expected**: 
   - Clear error message
   - Option to paste QR data manually

### Test 3: No Camera Available
1. Test on device without camera
2. **Expected**: 
   - Error message
   - Fallback to paste mode

### Test 4: Modified QR Data
1. Copy QR data
2. Modify the signature or batchId
3. Paste and verify
4. **Expected**: ❌ Signature verification fails

### Test 5: Different Network
1. Switch MetaMask to different network
2. Try to verify
3. **Expected**: 
   - Contract address mismatch error
   - Or network error

---

## 📊 Step 9: Verify Blockchain Data

1. **Check on Polygon Amoy Explorer**:
   - Visit: https://amoy.polygonscan.com
   - Search for contract: `0xd36e5c231DB89afe06Ff740b958e918618EcE058`
   - View contract interactions
   - Check your batch token

2. **Verify On-Chain Data**:
   - Token ID should match
   - Owner should match current owner
   - Metadata hash should match MongoDB

---

## 🐛 Troubleshooting

### Issue: Camera shows black screen
**Solution**: 
- Check browser permissions
- Try refreshing the page
- Use paste mode as fallback

### Issue: QR scan doesn't detect
**Solution**:
- Ensure good lighting
- Hold QR code steady
- Try different angles
- Use paste mode

### Issue: Signature verification fails
**Solution**:
- Ensure you're using the QR code generated by the manufacturer
- Check that contract address matches
- Verify network is Polygon Amoy

### Issue: "Batch not found"
**Solution**:
- Ensure batch was created successfully
- Check MongoDB connection
- Verify token ID is correct

### Issue: MetaMask transaction fails
**Solution**:
- Check you have enough MATIC
- Verify network is Polygon Amoy
- Check gas limit
- Try increasing gas price

---

## ✅ Success Criteria Checklist

- [ ] Backend server running on port 5000
- [ ] Frontend server running on port 3000
- [ ] MetaMask connected to Polygon Amoy
- [ ] Manufacturer account has MATIC
- [ ] Batch created successfully
- [ ] QR code generated with signature
- [ ] QR code saved/downloaded
- [ ] Camera permission granted
- [ ] QR code scanned successfully
- [ ] Verification shows "AUTHENTIC"
- [ ] All verification checks pass
- [ ] Supply chain history displayed
- [ ] Transfer to Distributor works
- [ ] Scan recorded on blockchain
- [ ] Security features work (wrong role detection)

---

## 📝 Notes

1. **QR Code Format**: 
   - Parent QR codes are URLs that redirect to verify page
   - Child QR codes contain JSON data directly

2. **Cryptographic Features**:
   - QR codes are signed by manufacturer
   - Signature verified on scan
   - Contract address verified
   - Hash integrity checked

3. **Mobile Testing**:
   - Use `npm run start:mobile` for network access
   - Access from mobile device on same network
   - Use mobile camera for scanning

4. **Development vs Production**:
   - Current setup uses Polygon Amoy (testnet)
   - For production, deploy to Polygon Mainnet
   - Update contract address in frontend

---

## 🎯 Quick Test Summary

```
1. Start servers (backend + frontend)
2. Connect as Manufacturer
3. Create batch
4. Generate QR code (sign with MetaMask)
5. Save QR code image
6. Go to Verify page
7. Click "Scan QR Code"
8. Allow camera permission
9. Point camera at QR code
10. Wait for auto-detection
11. Verify shows "AUTHENTIC"
12. Check all verification checks pass
```

---

**Happy Testing! 🚀**

If you encounter any issues, check the browser console and backend logs for error messages.

