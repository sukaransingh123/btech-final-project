import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ account, userRole, onDisconnect, networkLabel, balanceLabel }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleName = (role) => {
    switch (role) {
      case 1: return 'Manufacturer';
      case 2: return 'Distributor';
      case 3: return 'Retailer';
      case 4: return 'Pharmacy';
      default: return 'Consumer';
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-purple-100 text-purple-800';
      case 3: return 'bg-green-100 text-green-800';
      case 4: return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <nav className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 1h6v4H7V5zm8 8H5v-2h10v2z" clipRule="evenodd" />
              </svg>
              <span className="text-xl font-bold hidden sm:inline">PharmaTrust</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4 ml-8">
              <Link to="/" className="hover:text-blue-200 transition-colors font-medium">
                Dashboard
              </Link>
              {userRole === 1 && (
                <>
                  <Link to="/create-batch" className="hover:text-blue-200 transition-colors font-medium">
                    Create Batch
                  </Link>
                  <Link to="/generate-qr" className="hover:text-blue-200 transition-colors font-medium">
                    Generate QR
                  </Link>
                </>
              )}
              {(userRole === 2 || userRole === 3 || userRole === 4) && (
                <Link to="/transfer-batch" className="hover:text-blue-200 transition-colors font-medium">
                  Transfer Batch
                </Link>
              )}
              <Link to="/verify-batch" className="hover:text-blue-200 transition-colors font-medium">
                Verify
              </Link>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-4">
            {/* Desktop User Info */}
            <div className="hidden md:flex items-center gap-4">
              {networkLabel && (
                <div className="text-xs text-blue-200">
                  {networkLabel} {balanceLabel && `• ${balanceLabel}`}
                </div>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(userRole)}`}>
                {getRoleName(userRole)}
              </span>
              <div className="text-sm font-mono bg-blue-900/30 px-3 py-1 rounded-lg">
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
              </div>
              <button 
                onClick={onDisconnect}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-blue-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-blue-600">
            <div className="flex flex-col gap-2">
              <Link to="/" className="px-4 py-2 hover:bg-blue-800 rounded-lg">Dashboard</Link>
              {userRole === 1 && (
                <>
                  <Link to="/create-batch" className="px-4 py-2 hover:bg-blue-800 rounded-lg">Create Batch</Link>
                  <Link to="/generate-qr" className="px-4 py-2 hover:bg-blue-800 rounded-lg">Generate QR</Link>
                </>
              )}
              <Link to="/verify-batch" className="px-4 py-2 hover:bg-blue-800 rounded-lg">Verify</Link>
              <div className="px-4 py-2 border-t border-blue-600 mt-2 pt-2">
                <div className="text-xs text-blue-200 mb-2">
                  {networkLabel} {balanceLabel && `• ${balanceLabel}`}
                </div>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${getRoleBadgeClass(userRole)}`}>
                  {getRoleName(userRole)}
                </div>
                <div className="text-sm font-mono mb-2">
                  {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
                </div>
                <button 
                  onClick={onDisconnect}
                  className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;