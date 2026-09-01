const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Try loading env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-supply-chain';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('Connected to DB. Dropping database...');
  await mongoose.connection.db.dropDatabase();
  console.log('Database dropped successfully.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
