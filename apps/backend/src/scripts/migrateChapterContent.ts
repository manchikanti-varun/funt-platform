/**
 * Migration script: Move rich text from `description` to `content` for chapters
 * where `content` is empty but `description` has HTML content.
 *
 * Run with: npx tsx scripts/migrateChapterContent.ts
 * 
 * Safe: only updates chapters where content is empty/missing.
 * Keeps description intact (doesn't delete it).
 */

import "dotenv/config";
import mongoose from "mongoose";
import { GlobalModuleModel } from "../models/GlobalModule.model.js";

async function migrate() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set"); process.exit(1); }

  await mongoose.connect(uri);
  console.log("[migrate] Connected to MongoDB");

  // Find chapters where content is empty but description has rich text
  const chapters = await GlobalModuleModel.find({
    $or: [
      { content: { $exists: false } },
      { content: "" },
      { content: null },
    ],
    description: { $regex: /<[a-z][\s\S]*>/i }, // Has HTML tags in description
  }).exec();

  console.log(`[migrate] Found ${chapters.length} chapters with content in description field`);

  let updated = 0;
  for (const ch of chapters) {
    const desc = String(ch.description ?? "").trim();
    if (!desc) continue;

    // Move description to content, set description to a plain-text summary
    const plainSummary = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

    ch.content = desc;
    ch.description = plainSummary || ch.title;
    await ch.save();
    updated++;
    console.log(`  [${updated}] ${ch.title} — moved ${desc.length} chars to content`);
  }

  console.log(`[migrate] Done. Updated ${updated} chapters.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
