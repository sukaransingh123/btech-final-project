import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ethers } from 'ethers';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ManufacturerDashboard from './components/ManufacturerDashboard';
import DistributorDashboard from './components/DistributorDashboard';
import RetailerDashboard from './components/RetailerDashboard';
import ConsumerDashboard from './components/ConsumerDashboard';
import CreateBatch from './components/CreateBatch';
import TransferBatch from './components/TransferBatch';
import VerifyBatch from './components/VerifyBatch';
import GenerateQR from './components/GenerateQR';
import LinkBatch from './components/LinkBatch';
import RegisterManufacturer from './components/RegisterManufacturer';
import './App.css';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './utils/contract';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [readContract, setReadContract] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [network, setNetwork] = useState(null);
  const [maticBalance, setMaticBalance] = useState('');

  useEffect(() => {
    // Always initialize read-only contract (RPC provider) for verification
    initializeReadContract();
    // Auto-connect wallet if available (optional)
    checkWalletConnection();
  }, []);

  const initializeReadContract = async () => {
    try {
      const readProvider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
      const pharmaRead = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
      setReadContract(pharmaRead);
      console.log('Read-only contract initialized (no MetaMask required)');
    } catch (readError) {
      console.warn('Failed to initialize read contract:', readError);
      setReadContract(null);
    }
  };

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        console.log('Auto-connecting to accounts:', accounts);
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        console.error('Error details:', error.message);
      }
    } else {
      console.warn('MetaMask not detected - read-only mode available');
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      setLoading(true);
      console.log('Requesting MetaMask accounts...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('MetaMask accounts received:', accounts);
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      // Ensure Polygon Amoy (0x13882)
      const amoyChainIdHex = '0x13882';
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: amoyChainIdHex }],
        });
      } catch (switchError) {
        // If the chain has not been added to MetaMask, add it
        if (switchError && switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: amoyChainIdHex,
              chainName: 'Polygon Amoy',
              nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
              rpcUrls: ['https://rpc-amoy.polygon.technology'],
              blockExplorerUrls: ['https://www.oklink.com/amoy'],
            }],
          });
        } else {
          throw switchError;
        }
      }

      console.log('Creating provider and signer...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      console.log('Signer address:', signerAddress);
      console.log('Accounts[0]:', accounts[0]);
      
      // Verify addresses match
      if (signerAddress.toLowerCase() !== accounts[0].toLowerCase()) {
        console.warn('⚠️ Signer address does not match selected account!');
        console.warn('Signer:', signerAddress);
        console.warn('Selected:', accounts[0]);
      }
      
      setAccount(accounts[0]);
      
      // Initialize contracts (write with signer, read with dedicated RPC)
      console.log('Initializing contracts with address:', CONTRACT_ADDRESS);
      const pharmaContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(pharmaContract);
      // Read contract already initialized in useEffect
      // Just ensure it's set if not already
      if (!readContract) {
        await initializeReadContract();
      }
      
      // Network and balance
      const net = await provider.getNetwork();
      console.log('Network:', net);
      setNetwork(net);
      const bal = await provider.getBalance(accounts[0]);
      setMaticBalance(ethers.formatEther(bal));
      console.log('Balance:', ethers.formatEther(bal), 'MATIC');

      // Get user role
      try {
        console.log('Getting role for account:', accounts[0]);
        const role = await pharmaContract.getRole(accounts[0]);
        const roleNum = Number(role);
        console.log('Role from contract:', roleNum);
        setUserRole(roleNum);
        
        // If role is 0 (None), check if account matches known manufacturer
        if (roleNum === 0) {
          const { PARTICIPANTS } = await import('./utils/participants');
          const manufacturerAddr = (PARTICIPANTS?.MANUFACTURER || '').toLowerCase();
          const currentAddr = accounts[0].toLowerCase();
          
          if (manufacturerAddr && currentAddr === manufacturerAddr) {
            console.warn('⚠️ Account matches manufacturer but role is 0. Role may need to be set on contract.');
            console.warn('Manufacturer address:', manufacturerAddr);
            console.warn('Current address:', currentAddr);
            // Still set role to 0, but log the issue
          }
        }
      } catch (error) {
        console.error('Error getting user role:', error);
        console.error('Error details:', error.message);
        // Try to check if account matches known addresses
        try {
          const { PARTICIPANTS } = await import('./utils/participants');
          const currentAddr = accounts[0].toLowerCase();
          if (currentAddr === (PARTICIPANTS?.MANUFACTURER || '').toLowerCase()) {
            console.warn('⚠️ Could not get role from contract, but account matches manufacturer address');
          }
        } catch (e) {
          console.error('Error checking participants:', e);
        }
        setUserRole(0); // None role
      }
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      console.error('Full error:', error);
      
      let errorMessage = 'Failed to connect wallet';
      if (error.code === 4001) {
        errorMessage = 'MetaMask connection rejected. Please approve the connection request.';
      } else if (error.code === -32002) {
        errorMessage = 'MetaMask connection request already pending. Please check MetaMask.';
      } else if (error.message) {
        errorMessage = `Connection error: ${error.message}`;
      }
      
      alert(errorMessage);
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setUserRole(null);
  };

  const roleHome = () => {
    if (!account) return '/verify-batch'; // Default to verify for non-connected users
    switch (userRole) {
      case 1: return '/manufacturer';
      case 2: return '/distributor';
      case 3: return '/retailer';
      case 4: return '/consumer';
      default: return '/verify-batch';
    }
  };

  return (
    <Router>
      <div className="App">
        <Navbar 
          account={account} 
          userRole={userRole}
          networkLabel={network ? `Polygon Amoy` : ''}
          balanceLabel={maticBalance ? `${Number(maticBalance).toFixed(4)} MATIC` : ''}
          onDisconnect={disconnectWallet}
        />
        
        <div className="container">
          <Routes>
            {/* Verify routes - ALWAYS accessible, no MetaMask required */}
            <Route path="/verify-batch" element={<VerifyBatch contract={contract} readContract={readContract} account={account} />} />
            <Route path="/verify/:tokenId" element={<VerifyBatch contract={contract} readContract={readContract} account={account} />} />
            
            {/* Protected routes - require MetaMask */}
            {account ? (
              <>
                <Route path="/" element={<Dashboard contract={contract} readContract={readContract} account={account} userRole={userRole} />} />
                <Route path="/manufacturer" element={<ManufacturerDashboard contract={contract} account={account} userRole={userRole} />} />
                <Route path="/distributor" element={<DistributorDashboard contract={contract} account={account} userRole={userRole} />} />
                <Route path="/retailer" element={<RetailerDashboard contract={contract} account={account} userRole={userRole} />} />
                <Route path="/consumer" element={<ConsumerDashboard contract={contract} account={account} userRole={userRole} />} />
                <Route path="/create-batch" element={<CreateBatch contract={contract} account={account} />} />
                <Route path="/transfer-batch" element={<TransferBatch contract={contract} account={account} />} />
                <Route path="/generate-qr" element={<GenerateQR contract={contract} account={account} />} />
                <Route path="/link-batch" element={<LinkBatch contract={contract} account={account} />} />
                <Route path="/register-manufacturer" element={<RegisterManufacturer contract={contract} account={account} />} />
                <Route path="*" element={<Navigate to={roleHome()} replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={
                  <div className="card" style={{ textAlign: 'center', marginTop: '100px' }}>
                    <h1>Pharma Supply Chain Tracker</h1>
                    <p>Connect your MetaMask wallet to access the pharmaceutical supply chain system.</p>
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                      Or <a href="/verify-batch" style={{ color: '#4F46E5' }}>verify a product</a> without connecting (for consumers)
                    </p>
                    <button 
                      className="btn" 
                      onClick={connectWallet}
                      disabled={loading}
                    >
                      {loading ? 'Connecting...' : 'Connect MetaMask'}
                    </button>
                  </div>
                } />
                <Route path="*" element={<Navigate to="/verify-batch" replace />} />
              </>
            )}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
