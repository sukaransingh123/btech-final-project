const mongoose = require("mongoose");
const Batch = require("../backend/models/Batch");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", "env") });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/pharma-supply-chain");
  const batches = await Batch.find({});
  console.log(`Found ${batches.length} batches in DB.`);
  console.log(batches);
  process.exit(0);
}
main().catch(console.error);
