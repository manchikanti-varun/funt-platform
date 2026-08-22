import "dotenv/config";
import mongoose from "mongoose";

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);
  const db = mongoose.connection.db!;
  const batch = await db.collection("batches").findOne({ _id: new mongoose.Types.ObjectId("6a89c687bed2079c138cd17f") });
  const snap = (batch?.courseSnapshots ?? []).find((s: any) => s.courseId === "CRS-26-00063");
  const ch = (snap?.modules ?? [])[0];
  const content = ch?.content ?? "";
  
  // Extract ALL img tags with full detail
  const imgs = [...content.matchAll(/<img[^>]*>/gi)];
  console.log(`Total img tags: ${imgs.length}\n`);
  for (let i = 0; i < imgs.length; i++) {
    const full = imgs[i][0];
    console.log(`IMG ${i+1} (${full.length} chars):`);
    console.log(full);
    console.log("");
  }
  
  await mongoose.disconnect();
}
run().catch(err => { console.error(err); process.exit(1); });
