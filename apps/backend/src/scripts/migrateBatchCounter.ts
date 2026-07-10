/**
 * Migration script: Seed the global batch counter from existing batch IDs.
 *
 * Run once after deploying the new BT-XXXXXX format.
 * Finds the highest existing batch sequence number across all year-based keys
 * and sets the new global counter to start from the next value.
 *
 * Usage: npx tsx src/scripts/migrateBatchCounter.ts
 */

import mongoose from "mongoose";
import { CounterModel } from "../models/Counter.model.js";
import { BatchModel } from "../models/Batch.model.js";

async function migrate() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  // Find the highest sequence from existing batch IDs
  const batches = await BatchModel.find({ batchId: { $exists: true, $ne: null } })
    .select("batchId")
    .lean()
    .exec();

  let maxSeq = 0;
  for (const batch of batches) {
    const id = (batch as { batchId?: string }).batchId ?? "";
    // Handle both old format BT-YY-XXXXX and new format BT-XXXXXX
    const oldMatch = id.match(/^BT-\d{2}-(\d+)$/);
    const newMatch = id.match(/^BT-(\d+)$/);
    const seq = oldMatch ? parseInt(oldMatch[1], 10) : newMatch ? parseInt(newMatch[1], 10) : 0;
    if (seq > maxSeq) maxSeq = seq;
  }

  // Also check all year-based counter keys
  const counters = await CounterModel.find({ _id: /^batch_/ }).lean().exec();
  for (const counter of counters) {
    const seq = (counter as { seq?: number }).seq ?? 0;
    if (seq > maxSeq) maxSeq = seq;
  }

  console.log(`Highest existing batch sequence: ${maxSeq}`);
  console.log(`Setting global counter 'batch_global' to ${maxSeq}`);

  await CounterModel.findByIdAndUpdate(
    "batch_global",
    { $set: { seq: maxSeq } },
    { upsert: true }
  ).exec();

  console.log("Done! New batches will start from BT-" + String(maxSeq + 1).padStart(6, "0"));
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
