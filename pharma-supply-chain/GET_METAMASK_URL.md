# How to Access Website in MetaMask Browser

## Quick Steps

### 1. Find Your Computer's IP Address

**On Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your WiFi or Ethernet adapter. It will look like:
- `192.168.1.100` or
- `192.168.0.50` or
- `10.0.0.100`

### 2. Start Server with Network Access

Make sure your React server is running and accessible from network:

**PowerShell:**
```powershell
cd pharma-supply-chain/frontend
$env:HOST="0.0.0.0"; npm start
```

**Or Command Prompt:**
```cmd
cd pharma-supply-chain/frontend
set HOST=0.0.0.0 && npm start
```

### 3. Open in MetaMask Browser

In MetaMask mobile app:
1. Open MetaMask app
2. Tap the **Browser** tab (at the bottom)
3. In the address bar, type: `http://YOUR_IP:3000`
   - Replace `YOUR_IP` with your actual IP (e.g., `192.168.1.100`)
   - Example: `http://192.168.1.100:3000`

### 4. Connect Wallet in MetaMask Browser

1. Once the site loads, click "Connect MetaMask"
2. MetaMask will prompt you to connect
3. Make sure you're on Polygon Amoy network
4. You're ready to use the app!

## Troubleshooting

### Can't Access from MetaMask Browser

**Check 1: Same Network**
- Phone and computer must be on the same WiFi network
- Both devices must be connected to the same router

**Check 2: Firewall**
- Windows Firewall might be blocking the connection
- Go to: Windows Defender Firewall → Allow an app
- Make sure Node.js is allowed on Private networks

**Check 3: Server is Running**
- Make sure you see: "Compiled successfully!" in terminal
- The server should show: "webpack compiled successfully"
- Check that it says: "On Your Network: http://192.168.x.x:3000"

**Check 4: Use Correct IP**
- The IP shown in terminal after starting server is the one to use
- It should look like: `http://192.168.1.100:3000` (not localhost)

### Example URLs

If your IP is `192.168.1.100`, use:
- `http://192.168.1.100:3000` ✅

If your IP is `10.0.0.50`, use:
- `http://10.0.0.50:3000` ✅

**Never use:**
- `http://localhost:3000` ❌ (won't work from phone)
- `http://127.0.0.1:3000` ❌ (won't work from phone)

## Alternative: Use ngrok for External Access

If same-network doesn't work, use ngrok:

1. Install ngrok: Download from ngrok.com or `npm install -g ngrok`
2. Start React app normally: `npm start`
3. In another terminal: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Use that URL in MetaMask browser

## Quick Command Reference

**Find IP (Windows):**
```powershell
ipconfig | findstr IPv4
```

**Start with Network Access (PowerShell):**
```powershell
cd pharma-supply-chain/frontend
$env:HOST="0.0.0.0"; npm start
```

**Start with Network Access (CMD):**
```cmd
cd pharma-supply-chain/frontend
set HOST=0.0.0.0 && npm start
```

**Start with Network Access (npm script):**
```powershell
cd pharma-supply-chain/frontend
npm run start:mobile
```


