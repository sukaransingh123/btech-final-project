# IPFS Desktop Guide for Pharma Supply Chain

## What is IPFS Desktop?

IPFS Desktop is a desktop application that runs a local IPFS node. You don't need any API keys, tokens, or special configuration. It works out of the box!

**Important:** You don't need to connect your app to IPFS Desktop. IPFS Desktop uploads files to the IPFS network, and anyone can access them via public gateways (like `https://ipfs.io/ipfs/`). Your app just needs the CID (Content Identifier) that IPFS Desktop gives you.

---

## Step-by-Step Guide

### Step 1: Install and Start IPFS Desktop

1. Download IPFS Desktop from: https://docs.ipfs.tech/install/ipfs-desktop/
2. Install and launch the application
3. Wait for it to connect to the IPFS network (you'll see "Connected" status)
4. **That's it!** No configuration needed. You don't need to copy any peer IDs, agent info, or connection details.

### Step 2: Prepare Your Files

For your pharma supply chain project, you'll typically upload two types of files:

#### A. JSON File (Batch/Drug Metadata)
Create a JSON file with your batch information. Example:

**File: `batch-data.json`**
```json
{
  "batchID": "BATCH-2024-001",
  "drugName": "Paracetamol 500mg",
  "manufacturer": "PharmaCorp Inc.",
  "manufacturerLocation": "Mumbai, India",
  "mfgDate": "2024-01-15",
  "expiryDate": "2026-01-15",
  "quantity": 10000,
  "certificateCID": "QmYourCertificateCIDHere",
  "certificates": [
    "QmCertificateCID1",
    "QmCertificateCID2"
  ],
  "batchDetails": {
    "lotNumber": "LOT-12345",
    "storageConditions": "Store at 2-8°C"
  }
}
```

#### B. Certificate Files (PDF, Images, etc.)
- QA certificates (PDF)
- Test reports (PDF/Images)
- Any other documents related to the batch

### Step 3: Upload Files to IPFS Desktop

#### Method 1: Drag and Drop (Easiest)

1. Open IPFS Desktop
2. Click on the **"Files"** tab (or "Add" button)
3. **Drag and drop** your file (JSON or certificate) into the IPFS Desktop window
4. Wait a few seconds for the upload to complete
5. You'll see your file appear in the list with a **CID** next to it

#### Method 2: Using the Add Button

1. Open IPFS Desktop
2. Click **"Add"** or **"+"** button
3. Select **"File"** or **"Folder"**
4. Browse and select your file
5. Click **"Add"**
6. Wait for upload to complete

### Step 4: Copy the CID

After uploading, you'll see something like:

```
📄 batch-data.json
QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

1. **Click on the CID** (the long string starting with `Qm` or `bafy`)
2. It will be copied to your clipboard automatically
3. **OR** right-click on the file → **"Copy CID"**

**Important:** The CID is unique to that file. If you change the file and upload again, you'll get a different CID.

### Step 5: Use the CID in Your App

#### Option A: Generate QR Code

1. Navigate to: `http://localhost:3000/ipfs-qr` (or your app URL)
2. Paste the **JSON CID** in the input field
3. Click **"Generate QR"**
4. Download the QR code
5. This QR code points to: `https://ipfs.io/ipfs/<YOUR_JSON_CID>`

#### Option B: View IPFS Data

1. In your app, go to the **Verify Batch** page
2. In the "View IPFS Data" section, paste your **JSON CID**
3. Click **"Open IPFS View"**
4. OR navigate directly to: `http://localhost:3000/ipfs?cid=<YOUR_JSON_CID>`

---

## Complete Workflow Example

### Scenario: You want to create a batch with IPFS metadata

1. **Create JSON file:**
   ```json
   {
     "batchID": "BATCH-2024-001",
     "drugName": "Paracetamol 500mg",
     "manufacturer": "PharmaCorp",
     "mfgDate": "2024-01-15",
     "expiryDate": "2026-01-15",
     "quantity": 10000
   }
   ```
   Save as `batch-001.json`

2. **Upload to IPFS Desktop:**
   - Drag `batch-001.json` into IPFS Desktop
   - Copy the CID: `QmAbc123...`

3. **Upload certificate:**
   - Drag `certificate.pdf` into IPFS Desktop
   - Copy the CID: `QmXyz789...`

4. **Update JSON with certificate CID:**
   ```json
   {
     "batchID": "BATCH-2024-001",
     "drugName": "Paracetamol 500mg",
     "certificateCID": "QmXyz789...",
     ...
   }
   ```
   Save and upload again → Get new CID: `QmNew123...`

5. **Generate QR code:**
   - Go to `/ipfs-qr`
   - Paste `QmNew123...`
   - Generate and download QR

6. **View data:**
   - Go to `/ipfs?cid=QmNew123...`
   - See all batch details
   - Click certificate link to view certificate

---

## Common Questions

### Q: Do I need to keep IPFS Desktop running?
**A:** For uploading files, yes. But once uploaded, the files are on the IPFS network and accessible via public gateways. However, if you want to keep your files "pinned" (ensuring they stay available), keep IPFS Desktop running.

### Q: Do I need to configure anything in IPFS Desktop?
**A:** No! Just install, launch, and start uploading. No API keys, no tokens, no peer IDs needed.

### Q: What if my file is too large?
**A:** IPFS Desktop handles large files automatically. It may take longer to upload, but it will work.

### Q: Can I delete files from IPFS Desktop?
**A:** Yes, but remember: if you delete from your local IPFS Desktop, the file might still be available on the network if others have it. The CID will always point to that specific file version.

### Q: How do I know if my file is accessible?
**A:** After uploading, try accessing it directly:
- `https://ipfs.io/ipfs/<YOUR_CID>`
- If it loads, it's accessible!

### Q: What's the difference between Qm... and bafy... CIDs?
**A:** Both are valid CIDs. `Qm...` is the older format (CIDv0), `bafy...` is the newer format (CIDv1). Both work the same way in your app.

---

## Troubleshooting

### File not accessible via gateway?
- Wait a few minutes after uploading (propagation time)
- Make sure IPFS Desktop shows "Connected" status
- Try a different gateway: `https://gateway.pinata.cloud/ipfs/<CID>`

### CID not working in the app?
- Make sure you copied the full CID (it's long!)
- Check for extra spaces when pasting
- Verify the CID by accessing it directly: `https://ipfs.io/ipfs/<CID>`

### IPFS Desktop not connecting?
- Check your internet connection
- Restart IPFS Desktop
- Check firewall settings (IPFS uses port 4001)

---

## Quick Reference

| Action | Location | What You Need |
|--------|----------|---------------|
| Upload file | IPFS Desktop → Files tab | Your file (JSON, PDF, etc.) |
| Get CID | IPFS Desktop → Click on file | Copy the CID string |
| Generate QR | `/ipfs-qr` | JSON CID |
| View data | `/ipfs?cid=<CID>` | JSON CID |
| View in VerifyBatch | Verify Batch page | JSON CID in input field |

---

## Summary

1. ✅ Install IPFS Desktop (no config needed)
2. ✅ Upload your JSON file → Get CID
3. ✅ Upload certificates → Get CIDs
4. ✅ Update JSON with certificate CIDs → Upload again → Get final CID
5. ✅ Use final CID in your app (QR generator or viewer)

**No API keys, no tokens, no peer IDs needed!** Just upload and use the CID. 🚀

