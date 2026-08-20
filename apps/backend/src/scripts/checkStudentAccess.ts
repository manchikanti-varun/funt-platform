import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI!;

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const studentId = "6a765308bc467b58d3c71f1c";
  
  // Find the online batch
  const batch = await db.collection("batches").findOne({ name: /online.*Global/i, status: { $ne: "ARCHIVED" } });
  if (!batch) { console.log("Batch not found"); process.exit(1); }
  const batchMongoId = String(batch._id);
  console.log(`Batch: "${batch.name}" (${batchMongoId})`);
  console.log(`Courses in batch:`, (batch.courseSnapshots ?? []).map((s: any) => `${s.courseId} "${s.title}" isDemo=${s.isDemo ?? false}`));

  // Check enrollment
  const enrollment = await db.collection("enrollments").findOne({ studentId, batchId: batchMongoId, status: { $in: ["ACTIVE", "COMPLETED"] } });
  console.log(`\nEnrollment: ${enrollment ? `EXISTS (status: ${enrollment.status})` : "NONE"}`);

  // Check payments
  const allPayments = await db.collection("paymentsubmissions").find({ studentId, batchId: batchMongoId, status: "VERIFIED" }).toArray();
  console.log(`\nVerified payments for this student in this batch: ${allPayments.length}`);
  for (const p of allPayments) {
    console.log(`  - courseId: "${p.courseId ?? "EMPTY"}", amount: ${p.amountPaise}p, method: ${p.paymentMethod}, date: ${p.createdAt}`);
  }

  // Check license keys
  const allKeys = await db.collection("licensekeys").find({ usedByStudentId: studentId, batchId: batchMongoId }).toArray();
  console.log(`\nLicense keys for this student in this batch: ${allKeys.length}`);
  for (const k of allKeys) {
    console.log(`  - courseId: "${k.courseId ?? "EMPTY"}", key: ${k.key}, usedAt: ${k.usedAt}`);
  }

  // Check milestone progress
  const milestones = await db.collection("milestoneprogresses").find({ studentId, batchId: batchMongoId, unlocked: true }).toArray();
  console.log(`\nUnlocked milestones: ${milestones.length}`);
  for (const m of milestones) {
    console.log(`  - courseId: "${m.courseId}", milestoneId: ${m.milestoneId}`);
  }

  // Summary: Which courses should this student have access to?
  const paidCourseIds = new Set(allPayments.map(p => p.courseId).filter(Boolean));
  const keyedCourseIds = new Set(allKeys.map(k => k.courseId).filter(Boolean));
  const milestoneCourseIds = new Set(milestones.map(m => m.courseId).filter(Boolean));
  
  console.log("\n═══ ACCESS SUMMARY ═══");
  for (const snap of (batch.courseSnapshots ?? [])) {
    const cid = snap.courseId;
    const hasPay = paidCourseIds.has(cid);
    const hasKey = keyedCourseIds.has(cid);
    const hasMilestone = milestoneCourseIds.has(cid);
    const isDemo = snap.isDemo === true;
    const shouldHaveAccess = isDemo || hasPay || hasKey || hasMilestone;
    console.log(`  ${cid} "${snap.title}": ${shouldHaveAccess ? "✅ ACCESS" : "🔒 NO ACCESS"} (demo=${isDemo}, paid=${hasPay}, key=${hasKey}, milestone=${hasMilestone})`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
