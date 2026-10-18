import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ account, userRole, onDisconnect, networkLabel, balanceLabel }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleName = (role) => {
    if (role == null || role === undefined) return 'Not Connected';
    switch (Number(role)) {
      case 1: return 'Manufacturer';
      case 2: return 'Distributor';
      case 3: return 'Retailer';
      case 4: return 'Pharmacy';
      case 0: return 'No Role';
      default: return 'Unknown';
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (Number(role)) {
      case 1: return 'badge badge-gold';
      case 2: return 'badge badge-purple';
      case 3: return 'badge badge-green';
      case 4: return 'badge badge-blue';
      default: return 'badge badge-blue';
    }
  };

  return (
    <nav style={{
      background: 'linear-gradient(90deg, #081526 0%, #0f2035 60%, #162d4a 100%)',
      borderBottom: '1px solid rgba(251,191,36,0.2)',
      position: 'sticky', top: 0, zIndex: 50,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
    }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link to={account ? "/" : "/verify-batch"} className="flex items-center gap-3" style={{textDecoration:'none'}}>
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                borderRadius: '10px', padding: '7px',
                boxShadow: '0 0 14px rgba(245,158,11,0.4)'
              }}>
                <svg className="w-5 h-5" fill="#0f2035" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 1h6v4H7V5zm8 8H5v-2h10v2z" clipRule="evenodd" />
                </svg>
              </div>
              <span style={{
                fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.5px',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }} className="hidden sm:inline">
                PharmaTrust
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {[
                { to: '/', label: 'Dashboard', show: true },
                { to: '/create-batch', label: 'Create Batch', show: userRole === 1 },
                { to: '/generate-qr', label: 'Generate QR', show: userRole === 1 },
                { to: '/transfer-batch', label: 'Transfer Batch', show: [1,2,3,4].includes(Number(userRole)) },
                { to: '/verify-batch', label: 'Verify', show: userRole !== 1 },
              ].filter(l => l.show).map(link => (
                <Link key={link.to} to={link.to} style={{
                  color: '#94a3b8', padding: '6px 14px', borderRadius: '8px',
                  textDecoration: 'none', fontSize: '14px', fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.target.style.color='#f59e0b'; e.target.style.background='rgba(245,158,11,0.08)'; }}
                onMouseLeave={e => { e.target.style.color='#94a3b8'; e.target.style.background='transparent'; }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {networkLabel && (
              <div style={{textAlign:'right', lineHeight:'1.2'}}>
                <div style={{fontSize:'11px', color:'#64748b', fontWeight:500}}>{networkLabel}</div>
                {balanceLabel && <div style={{fontSize:'13px', color:'#f59e0b', fontWeight:700}}>{balanceLabel}</div>}
              </div>
            )}
            <span className={getRoleBadgeClass(userRole)}>{getRoleName(userRole)}</span>
            <div style={{
              fontFamily:'monospace', fontSize:'13px',
              background:'rgba(15,32,53,0.8)', border:'1px solid rgba(251,191,36,0.2)',
              padding:'6px 12px', borderRadius:'8px', color:'#94a3b8'
            }}>
              {account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Not connected'}
            </div>
            <button onClick={onDisconnect} style={{
              background:'rgba(239,68,68,0.15)', color:'#ef4444',
              border:'1px solid rgba(239,68,68,0.3)', padding:'7px 16px',
              borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer',
              transition:'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background='rgba(239,68,68,0.3)'}
            onMouseLeave={e => e.target.style.background='rgba(239,68,68,0.15)'}>
              Disconnect
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg"
            style={{color:'#94a3b8', background:'rgba(30,58,95,0.4)', border:'1px solid rgba(251,191,36,0.15)'}}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{borderTop:'1px solid rgba(251,191,36,0.15)', padding:'16px 0'}}>
            <div className="flex flex-col gap-1">
              {[
                { to: '/', label: 'Dashboard', show: true },
                { to: '/create-batch', label: 'Create Batch', show: userRole === 1 },
                { to: '/generate-qr', label: 'Generate QR', show: userRole === 1 },
                { to: '/transfer-batch', label: 'Transfer Batch', show: [1,2,3,4].includes(Number(userRole)) },
                { to: '/verify-batch', label: 'Verify', show: userRole !== 1 },
              ].filter(l => l.show).map(link => (
                <Link key={link.to} to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{color:'#94a3b8', padding:'10px 16px', borderRadius:'8px', textDecoration:'none', fontWeight:500}}>
                  {link.label}
                </Link>
              ))}
              <div style={{borderTop:'1px solid rgba(251,191,36,0.1)', marginTop:'8px', paddingTop:'12px', paddingLeft:'16px'}}>
                {networkLabel && <div style={{fontSize:'12px', color:'#64748b', marginBottom:'6px'}}>{networkLabel} {balanceLabel && `• ${balanceLabel}`}</div>}
                <span className={getRoleBadgeClass(userRole)} style={{marginBottom:'8px', display:'inline-block'}}>{getRoleName(userRole)}</span>
                <div style={{fontFamily:'monospace', fontSize:'13px', color:'#94a3b8', marginBottom:'10px'}}>
                  {account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Not connected'}
                </div>
                <button onClick={onDisconnect} style={{
                  background:'rgba(239,68,68,0.15)', color:'#ef4444',
                  border:'1px solid rgba(239,68,68,0.3)', padding:'8px 20px',
                  borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', width:'100%'
                }}>Disconnect</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;