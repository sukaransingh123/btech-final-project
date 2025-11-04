import React from 'react';
import { Link } from 'react-router-dom';

const DistributorDashboard = ({ account, userRole }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Distributor Dashboard</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-purple-100 rounded-xl">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
            </div>
            <div className="space-y-4">
              <Link to="/transfer-batch" className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center">
                Transfer Batch
              </Link>
              <Link to="/verify-batch" className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center">
                Verify Batch
              </Link>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Overview</h2>
            <div className="bg-purple-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 font-medium">Connected:</span>
                <span className="font-mono text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                  {account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Not connected'}
                </span>
              </div>
              <div className="pt-4 border-t border-purple-200">
                <p className="text-sm text-gray-600">
                  As a distributor, you can receive batches from manufacturers and transfer them to retailers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributorDashboard;