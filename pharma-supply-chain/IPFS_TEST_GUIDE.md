# Quick IPFS Test Guide

## Method 1: Quick Test with Sample CID (Fastest)

1. **Use a test CID** - Try this sample IPFS CID: `QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG`
   - This is a public test file on IPFS

2. **On your current page (`/verify-batch`):**
   - Scroll down to the **"View IPFS Data"** section (light blue box)
   - Paste the CID: `QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG`
   - Click **"Open IPFS View"**

3. **Expected Result:**
   - You should be redirected to `/ipfs?cid=...`
   - The page should load and display JSON data from IPFS
   - If you see data, IPFS is working! ✅

---

## Method 2: Full Test with Your Own Data (Complete Workflow)

### Step 1: Generate Your JSON File

1. Navigate to: `http://localhost:3000/generate-ipfs-json`
   - Or click "Generate IPFS JSON" from Dashboard (if connected)

2. Fill in the form:
   - Batch ID: `TEST-001`
   - Drug Name: `Test Drug`
   - Manufacturing Date: (any date)
   - Expiry Date: (any future date)
   - Quantity: `100`
   - (Certificate CID is optional for now)

3. Click **"Download JSON"**
   - File will be saved as `batch-TEST-001.json`

### Step 2: Upload to IPFS Desktop

1. Open **IPFS Desktop** application
2. Go to **"Files"** tab
3. **Drag and drop** your `batch-TEST-001.json` file into IPFS Desktop
4. Wait a few seconds for upload
5. **Copy the CID** that appears (starts with `Qm` or `bafy`)

### Step 3: Test on Verify Batch Page

1. Go back to: `http://localhost:3000/verify-batch`
2. Scroll to **"View IPFS Data"** section
3. Paste your CID in the input field
4. Click **"Open IPFS View"**
5. You should see your batch data displayed! ✅

### Step 4: Generate QR Code (Optional)

1. Navigate to: `http://localhost:3000/ipfs-qr`
2. Paste your JSON CID
3. Click **"Generate QR"**
4. Download the QR code
5. Scan it with your phone - it should open the IPFS URL

---

## Troubleshooting

### If "Open IPFS View" shows an error:
- **Check:** Is IPFS Desktop running and connected?
- **Check:** Did you copy the full CID (it's long)?
- **Try:** Wait 1-2 minutes after uploading (IPFS propagation time)
- **Try:** Use the test CID first to verify the gateway works

### If the page loads but shows "Failed to fetch":
- The CID might not be accessible yet (wait a bit)
- Try a different IPFS gateway (we use `ipfs.io`)
- Make sure IPFS Desktop shows "Connected" status

### If you see your data correctly:
🎉 **Success!** Your IPFS integration is working perfectly!

