# Fix Role Issue - Quick Guide

## Problem
Your role is showing as "Consumer" (which means role = 0 or None) and MetaMask might not be connecting properly.

## Quick Fix Steps

### Step 1: Check Your MetaMask Account
1. Open MetaMask
2. Make sure you're connected to **Polygon Amoy Testnet**
3. Check which account is selected
4. **Expected Manufacturer Account**: `0x6c45a0ea03e5719a4a8d5fb2c2a7ed4d59ea2267`

### Step 2: Set Roles on Contract
Run this command to set roles on the contract:

```bash
cd C:\Users\marya\pharma\btechproject\pharma-supply-chain
npx hardhat run scripts/setRoles.js --network amoy
```

This will:
- Register manufacturer: `0x6c45A0eA03E5719a4A8d5fb2c2A7eD4D59eA2267`
- Set role 1 (Manufacturer) for manufacturer
- Set role 2 (Distributor) for distributor
- Set role 3 (Retailer) for retailer
- Set role 4 (Pharmacy) for pharmacy
- Verify all roles were set correctly

### Step 3: Reconnect MetaMask
1. **Disconnect** from the app (click "Disconnect" button)
2. **Refresh** the page (F5)
3. **Click "Connect MetaMask"** again
4. **Select the manufacturer account**: `0x6c45a0ea03e5719a4a8d5fb2c2a7ed4d59ea2267`
5. **Approve** the connection

### Step 4: Check Browser Console
Open browser console (F12) and look for:
- `Getting role for account: 0x6c45...`
- `Role from contract: 1` (should be 1 for Manufacturer, not 0)
- If you see `Role from contract: 0`, the role wasn't set on the contract

## Expected Results

After fixing:
- Role should show: **"Manufacturer"** (not "Consumer")
- Account should be: `0x6c45...2267`
- Network should be: **Polygon Amoy**
- You should see "Create Batch" and "Generate QR" in navigation

## If Still Not Working

1. **Check Contract Address**: Make sure it matches `0xd36e5c231DB89afe06Ff740b958e918618EcE058`
2. **Check Account**: Make sure you're using the manufacturer account
3. **Check Network**: Must be Polygon Amoy (Chain ID: 80002)
4. **Run setRoles script**: The role might not be set on the contract

## Debugging

Check browser console for:
- `Getting role for account: ...` - Shows which account is being checked
- `Role from contract: X` - Shows the role number (should be 1 for Manufacturer)
- `⚠️ Account matches manufacturer but role is 0` - Means role needs to be set
- Any error messages about MetaMask connection

