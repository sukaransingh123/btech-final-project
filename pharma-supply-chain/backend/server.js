const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', 'env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded QA certificates)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection — non-blocking: server starts even if Atlas is paused
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-supply-chain';
global.mongoAvailable = false;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // give up after 5s, don't hang
  connectTimeoutMS: 5000,
})
.then(() => {
  global.mongoAvailable = true;
  console.log('✅ MongoDB connected successfully');
  try { require('./listeners/blockchainListener'); } catch(e) {}
})
.catch((error) => {
  global.mongoAvailable = false;
  console.error('⚠️  MongoDB unavailable (Atlas may be paused) — running in blockchain-only mode');
});

// Routes
app.use('/api/batches', require('./routes/batches'));
app.use('/api/metadata', require('./routes/metadata'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/supply-chain', require('./routes/supplyChain'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

