# Mobile Testing Guide - Testing QR Codes from Your Phone

## Quick Setup for Testing from Phone

### Step 1: Start the Server with Network Access

**On Windows (PowerShell):**
```powershell
cd frontend
$env:HOST="0.0.0.0"; npm start
```

**On Windows (Command Prompt):**
```cmd
cd frontend
set HOST=0.0.0.0 && npm start
```

**On Mac/Linux:**
```bash
cd frontend
HOST=0.0.0.0 npm start
```

Or use the npm script:
- Windows: `npm run start:mobile`
- Mac/Linux: `npm run start:network`

### Step 2: Find Your Computer's IP Address

**On Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet).

**On Mac/Linux:**
```bash
ifconfig | grep "inet "
```
or
```bash
ip addr show | grep "inet "
```

You'll see something like: `192.168.1.100` or `10.0.0.50`

### Step 3: Connect Your Phone to Same Network

1. Make sure your phone is connected to the **same WiFi network** as your computer
2. Both devices must be on the same local network

### Step 4: Generate QR Code

1. Open the app in your browser: `http://localhost:3000`
2. Generate a parent QR code
3. The QR code will automatically use your network IP (e.g., `http://192.168.1.100:3000`) instead of localhost
4. You'll see the network IP displayed in the QR code details

### Step 5: Scan from Phone

1. Open your phone's camera app (or any QR scanner)
2. Scan the QR code displayed on your computer screen
3. The QR code will open in your phone's browser at: `http://YOUR_IP:3000/verify?data=...`
4. The verification page will load and verify the product

## Troubleshooting

### QR Code Still Shows localhost
- Make sure you restarted the dev server after setting HOST=0.0.0.0
- Check the browser console for any errors
- The network IP detection might take a moment - refresh the page if needed

### Can't Access from Phone
1. **Check Firewall**: Windows Firewall might be blocking the connection
   - Go to Windows Defender Firewall → Allow an app
   - Make sure Node.js is allowed on Private networks

2. **Check Network**: Ensure both devices are on the same network
   - Phone and computer must be on the same WiFi

3. **Try Direct IP**: Instead of scanning, try typing the URL directly in your phone's browser:
   - `http://YOUR_IP:3000` (replace YOUR_IP with your computer's IP)

### Alternative: Use ngrok (External Access)

If same-network access doesn't work, you can use ngrok:

1. Install ngrok: `npm install -g ngrok` or download from ngrok.com
2. Start your React app normally: `npm start`
3. In another terminal, run: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Set environment variable: Create `.env` in frontend folder:
   ```
   REACT_APP_PUBLIC_BASE_URL=https://abc123.ngrok.io
   ```
6. Restart the React app and generate a new QR code

## Notes

- Parent QR codes are designed to work **only through the website** (not generic QR scanners)
- The QR code contains a URL that opens the verification page
- The verification page automatically extracts and verifies the QR data
- Child QR codes contain JSON data and can be scanned by any QR scanner

## Security Note

When testing on localhost/network IP, the connection is not encrypted (HTTP). For production, always use HTTPS and a proper domain name.


