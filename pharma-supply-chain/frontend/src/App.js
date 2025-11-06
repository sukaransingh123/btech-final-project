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
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

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

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      setAccount(accounts[0]);
      
      // Initialize contracts (write with signer, read with dedicated RPC)
      const pharmaContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(pharmaContract);
      try {
        const readProvider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
        const pharmaRead = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
        setReadContract(pharmaRead);
      } catch (_) {
        setReadContract(null);
      }
      
      // Network and balance
      const net = await provider.getNetwork();
      setNetwork(net);
      const bal = await provider.getBalance(accounts[0]);
      setMaticBalance(ethers.formatEther(bal));

      // Get user role
      try {
        const role = await pharmaContract.getRole(accounts[0]);
        setUserRole(Number(role));
      } catch (error) {
        console.error('Error getting user role:', error);
        setUserRole(0); // None role
      }
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setUserRole(null);
  };

  if (!account) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', marginTop: '100px' }}>
          <h1>Pharma Supply Chain Tracker</h1>
          <p>Connect your MetaMask wallet to access the pharmaceutical supply chain system.</p>
          <button 
            className="btn" 
            onClick={connectWallet}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      </div>
    );
  }

  const roleHome = () => {
    switch (userRole) {
      case 1: return '/manufacturer';
      case 2: return '/distributor';
      case 3: return '/retailer';
      case 4: return '/consumer';
      default: return '/';
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
            <Route path="/" element={<Dashboard contract={contract} readContract={readContract} account={account} userRole={userRole} />} />
            <Route path="/manufacturer" element={<ManufacturerDashboard contract={contract} account={account} userRole={userRole} />} />
            <Route path="/distributor" element={<DistributorDashboard contract={contract} account={account} userRole={userRole} />} />
            <Route path="/retailer" element={<RetailerDashboard contract={contract} account={account} userRole={userRole} />} />
            <Route path="/consumer" element={<ConsumerDashboard contract={contract} account={account} userRole={userRole} />} />
            <Route path="/create-batch" element={<CreateBatch contract={contract} account={account} />} />
            <Route path="/transfer-batch" element={<TransferBatch contract={contract} account={account} />} />
            <Route path="/verify-batch" element={<VerifyBatch contract={contract} readContract={readContract} account={account} />} />
            <Route path="/generate-qr" element={<GenerateQR contract={contract} account={account} />} />
            <Route path="/link-batch" element={<LinkBatch contract={contract} account={account} />} />
            <Route path="/register-manufacturer" element={<RegisterManufacturer contract={contract} account={account} />} />
            <Route path="/verify/:tokenId" element={<VerifyBatch contract={contract} readContract={readContract} account={account} />} />
            <Route path="*" element={<Navigate to={roleHome()} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
