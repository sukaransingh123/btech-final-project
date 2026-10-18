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
import QRGenerator from './components/QRGenerator';
import GenerateIPFSJson from './components/GenerateIPFSJson';
import IpfsViewPage from './pages/IpfsViewPage';
import SupplyChainTracker from './components/SupplyChainTracker';
import LifecyclePortal from './components/LifecyclePortal';
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

    // Listen for MetaMask account and chain changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // User disconnected all accounts
          setAccount(null);
          setContract(null);
          setUserRole(null);
        } else {
          // Account switched — reconnect
          connectWallet();
        }
      };
      const handleChainChanged = () => {
        window.location.reload();
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const initializeReadContract = async () => {
    try {
      const readProvider = new ethers.JsonRpcProvider('https://polygon-amoy.drpc.org');
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
        setLoading(false); // Fixed: clear loading on successful connection
        
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
    if (!account) return '/verify-batch';
    switch (userRole) {
      case 1: return '/manufacturer';
      case 2: return '/distributor';
      case 3: return '/retailer';
      case 4: return '/consumer'; // Pharmacy maps to consumer dashboard
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
        
        <div style={{ background: '#081526', minHeight: '100vh', width: '100%', margin: 0, padding: 0 }}>
          <Routes>
            {/* Verify routes - ALWAYS accessible, no MetaMask required */}
            <Route path="/verify-batch" element={<VerifyBatch contract={contract} readContract={readContract} account={account} />} />
            <Route path="/supply-chain-tracker" element={<SupplyChainTracker />} />
            <Route path="/lifecycle-portal" element={<LifecyclePortal />} />
            <Route path="/verify/:tokenId" element={<VerifyBatch contract={contract} readContract={readContract} account={account} />} />
            <Route path="/ipfs" element={<IpfsViewPage />} />
            <Route path="/ipfs-qr" element={<QRGenerator />} />
            <Route path="/generate-ipfs-json" element={<GenerateIPFSJson contract={contract} account={account} />} />
            
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
                  <div style={{
                    minHeight:'100vh',
                    background:'linear-gradient(135deg,#081526 0%,#0f2035 55%,#162d4a 100%)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Inter,system-ui,sans-serif', padding:'24px'
                  }}>
                    <div style={{
                      background:'linear-gradient(135deg,rgba(30,58,95,0.7),rgba(22,45,74,0.9))',
                      border:'1px solid rgba(251,191,36,0.2)',
                      borderRadius:'24px', padding:'56px 48px', maxWidth:'520px', width:'100%',
                      textAlign:'center', boxShadow:'0 24px 80px rgba(0,0,0,0.5)'
                    }}>
                      {/* Logo icon */}
                      <div style={{display:'flex',justifyContent:'center',marginBottom:'28px'}}>
                        <div style={{
                          background:'linear-gradient(135deg,#f59e0b,#d97706)',
                          borderRadius:'20px', padding:'18px',
                          boxShadow:'0 0 30px rgba(245,158,11,0.4)'
                        }}>
                          <svg style={{width:'40px',height:'40px'}} fill="#0f2035" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 1h6v4H7V5zm8 8H5v-2h10v2z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <h1 style={{
                        fontSize:'2.2rem', fontWeight:800, letterSpacing:'-0.5px',
                        background:'linear-gradient(90deg,#f59e0b,#fbbf24)',
                        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                        marginBottom:'12px'
                      }}>PharmaTrust</h1>
                      <p style={{color:'#94a3b8', fontSize:'16px', marginBottom:'8px', fontWeight:500}}>
                        Pharmaceutical Supply Chain
                      </p>
                      <p style={{color:'#475569', fontSize:'13px', marginBottom:'36px'}}>
                        Powered by Polygon Blockchain · NFT-based Batch Tracking
                      </p>

                      {/* Feature pills */}
                      <div style={{display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center', marginBottom:'36px'}}>
                        {['🔗 Blockchain Secured','🧾 NFT Batch Tokens','🔍 QR Verification','📦 Supply Chain Audit'].map(f => (
                          <span key={f} style={{
                            background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
                            color:'#f59e0b', padding:'5px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:500
                          }}>{f}</span>
                        ))}
                      </div>

                      <button onClick={connectWallet} disabled={loading} style={{
                        background: loading ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
                        color:'#0f2035', border:'none', borderRadius:'12px',
                        padding:'14px 40px', fontSize:'16px', fontWeight:700,
                        cursor: loading ? 'not-allowed' : 'pointer', width:'100%',
                        boxShadow:'0 4px 20px rgba(245,158,11,0.35)',
                        transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'
                      }}>
                        <svg style={{width:'20px',height:'20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                        </svg>
                        {loading ? 'Connecting…' : 'Connect MetaMask'}
                      </button>

                      <p style={{color:'#334155', fontSize:'12px', marginTop:'20px'}}>
                        Don't have access?{' '}
                        <a href="/verify-batch" style={{color:'#f59e0b', textDecoration:'none', fontWeight:600}}>
                          Scan &amp; Verify a batch →
                        </a>
                      </p>
                    </div>
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
