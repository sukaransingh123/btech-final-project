import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = ({ contract, readContract, account, userRole }) => {
  const [stats, setStats] = useState({
    totalBatches: 0,
    myBatches: 0,
    pendingTransfers: 0
  });
  const [recentBatches, setRecentBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contract) {
      loadDashboardData();
    }
  }, [contract, readContract, account]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const c = readContract || contract;
      
      // Try MongoDB API first for faster loading (if available)
      try {
        const apiService = (await import('../utils/api')).default;
        const response = await Promise.race([
          apiService.getAllBatches({ owner: account }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        if (response.success && response.batches) {
          const myBatches = response.batches.filter(b => b.currentOwner?.toLowerCase() === account?.toLowerCase());
          const totalBatches = response.batches.filter(b => !b.parentBatchId).length;
          setStats({ totalBatches, myBatches: myBatches.length, pendingTransfers: 0 });
          setRecentBatches(response.batches.slice(0, 5).map(b => ({
            tokenId: b.tokenId,
            batchID: b.batchID,
            owner: b.currentOwner,
            role: b.currentRole,
            timestamp: new Date(b.createdAt).getTime() / 1000
          })));
          setLoading(false);
          return;
        }
      } catch (e) {
        // Fallback to blockchain
      }

      // OPTIMIZED: Parallel blockchain queries
      const tokenCounter = Number(await c.tokenCounter());
      // Scan all tokens (up to 200 for safety) to find all batches
      const maxToScan = Math.min(tokenCounter - 1, 200);
      
      if (maxToScan <= 0) {
        setStats({ totalBatches: 0, myBatches: 0, pendingTransfers: 0 });
        setLoading(false);
        return;
      }

      const tokenIds = Array.from({ length: maxToScan }, (_, i) => i + 1);
      const allBatches = [];
      const myBatches = [];
      let totalBatches = 0;
      let myBatchesCount = 0;

      const batchSize = 10;
      for (let i = 0; i < tokenIds.length; i += batchSize) {
        const chunk = tokenIds.slice(i, i + batchSize);
        const promises = chunk.map(async (tokenId) => {
          try {
            const [parent, owner, batchDetails] = await Promise.all([
              c.getParentBatch(tokenId).catch(() => 0),
              c.ownerOf(tokenId).catch(() => null),
              c.getBatchDetails(tokenId).catch(() => null)
            ]);
            return { tokenId, parent: Number(parent), owner, batchDetails };
          } catch {
            return null;
          }
        });
        
        const results = await Promise.all(promises);
        
        results.forEach(result => {
          if (result && result.batchDetails) {
            if (result.parent === 0) {
              totalBatches++;
              allBatches.push({
                tokenId: result.tokenId,
                batchID: result.batchDetails.batchID,
                owner: result.owner,
                role: Number(result.batchDetails.currentRole),
                timestamp: Number(result.batchDetails.timestamp)
              });
            }
            // Check if owned by current user
            if (result.owner?.toLowerCase() === account?.toLowerCase()) {
              if (result.parent === 0) {
                myBatchesCount++;
              }
              // Add to myBatches if it's a parent batch or owned by user
              if (result.parent === 0) {
                myBatches.push({
                  tokenId: result.tokenId,
                  batchID: result.batchDetails.batchID,
                  owner: result.owner,
                  role: Number(result.batchDetails.currentRole),
                  timestamp: Number(result.batchDetails.timestamp)
                });
              }
            }
          }
        });
      }
      
      setStats({
        totalBatches,
        myBatches: myBatchesCount,
        pendingTransfers: 0
      });
      
      // Show recent batches owned by user (up to 10), sorted by timestamp
      setRecentBatches(myBatches.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10));
      
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (role) => {
    const roles = {
      'Manufacturer': 'Manufacturer',
      'Distributor': 'Distributor',
      'Retailer': 'Retailer',
      'Pharmacy': 'Pharmacy'
    };
    return roles[role] || 'Unknown';
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      'Manufacturer': 'role-manufacturer',
      'Distributor': 'role-distributor',
      'Retailer': 'role-retailer',
      'Pharmacy': 'role-pharmacy'
    };
    return classes[role] || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">Total Batches</h3>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <div className="text-4xl font-bold text-blue-600 mb-2">{stats.totalBatches}</div>
            <p className="text-gray-500 text-sm">Batches in the system</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">My Batches</h3>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-4xl font-bold text-green-600 mb-2">{stats.myBatches}</div>
            <p className="text-gray-500 text-sm">Batches owned by you</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">Pending Transfers</h3>
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-4xl font-bold text-orange-600 mb-2">{stats.pendingTransfers}</div>
            <p className="text-gray-500 text-sm">Awaiting your action</p>
          </div>
        </div>

        {/* Recent Batches */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Batches</h2>
          {recentBatches.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500">No batches found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentBatches.map((batch) => (
                <div key={batch.tokenId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-gray-900">Batch ID:</span>
                        <span className="text-blue-600 font-semibold">{batch.batchID}</span>
                        <span className="text-gray-400">(Token #{batch.tokenId})</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Owner: {batch.owner?.slice(0, 6)}...{batch.owner?.slice(-4)}</span>
                        <span className={`role-badge ${getRoleBadgeClass(getRoleName(batch.role))}`}>
                          {getRoleName(batch.role)}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(batch.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            {(userRole === 1) && (
              <>
                <Link to="/create-batch" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Batch
                </Link>
                <Link to="/generate-qr" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Generate QR Code
                </Link>
                <Link to="/transfer-batch" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Transfer Batch
                </Link>
              </>
            )}
            {(userRole === 2 || userRole === 3 || userRole === 4) && (
              <Link to="/transfer-batch" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Transfer Batch
              </Link>
            )}
            <Link to="/verify-batch" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verify Batch
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;