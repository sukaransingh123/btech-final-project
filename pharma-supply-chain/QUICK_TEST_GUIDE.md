# 🚀 Quick Testing Guide - QR Code Scanning

## ⚡ Quick Start (5 Minutes)

### 1. Start Servers
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend  
cd frontend
npm start
```

### 2. Connect MetaMask
- Open `http://localhost:3000`
- Click "Connect Wallet"
- Select Manufacturer account: `0x6c45a0ea03e5719a4a8d5fb2c2a7ed4d59ea2267`
- Ensure Polygon Amoy network is selected

### 3. Create Batch
- Go to "Create Batch"
- Fill details:
  - Batch ID: `TEST-001`
  - Drug Name: `Paracetamol`
  - Dates: Today + 2 years
- Click "Create Batch"
- Confirm MetaMask transaction

### 4. Generate QR Code
- Go to "Generate QR"
- Select your batch
- Click "Generate QR Code"
- **Sign with MetaMask** (important!)
- Download/save QR code image

### 5. Test QR Scanning
- Go to "Verify" page
- Click "Scan QR Code"
- **Allow camera permission**
- Point camera at QR code
- Wait for auto-detection (1-2 seconds)
- Verification should show "✅ AUTHENTIC"

---

## 📱 Testing QR Scanner Features

### ✅ What Should Work:
- [x] Camera opens when clicking "Scan QR Code"
- [x] Camera permission prompt appears
- [x] Video feed displays (not black screen)
- [x] QR code detection works (auto-closes on scan)
- [x] QR data appears in input field
- [x] Verification starts automatically
- [x] Shows "AUTHENTIC" with all checks passed

### 🔍 Verification Checks:
1. ✅ Hash Integrity
2. ✅ Counterfeit Flag
3. ✅ QR Signature (manufacturer signature)
4. ✅ Contract Address Match
5. ✅ Blockchain Cross-Check

---

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Black screen | Refresh page, check permissions |
| No camera | Use "Paste" mode instead |
| Permission denied | Click browser's camera icon in address bar |
| QR not detected | Better lighting, hold steady |
| Verification fails | Check QR code is from manufacturer |

---

## 🎯 Test Scenarios

### Scenario 1: Happy Path ✅
1. Create batch → Generate QR → Scan → Verify
2. **Expected**: All checks pass, shows AUTHENTIC

### Scenario 2: Wrong QR ❌
1. Modify QR data manually
2. Scan modified QR
3. **Expected**: Signature verification fails

### Scenario 3: No Camera 📱
1. Deny camera permission
2. Use paste mode
3. **Expected**: Manual entry works

---

## 📊 Success Indicators

✅ **Scanner Working:**
- Camera feed visible (not black)
- QR detection works
- Auto-closes on scan

✅ **Verification Working:**
- Shows "AUTHENTIC"
- All 5 checks pass
- Product details displayed
- Supply chain history shown

---

## 🔗 Important URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health
- **Contract**: 0xd36e5c231DB89afe06Ff740b958e918618EcE058
- **Explorer**: https://amoy.polygonscan.com/address/0xd36e5c231DB89afe06Ff740b958e918618EcE058

---

## 💡 Pro Tips

1. **Save QR codes** for repeated testing
2. **Use mobile device** for better camera testing
3. **Check browser console** for errors
4. **Test on different browsers** (Chrome, Firefox, Safari)
5. **Test with different QR codes** (parent vs child)

---

**Need more details?** See `TESTING_WORKFLOW.md` for complete guide.

