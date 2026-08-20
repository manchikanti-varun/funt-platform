/**
 * Diagnose Multi-Course Access Bug
 * 
 * Finds payments and license keys that might grant unintended batch-wide access:
 * - Payments with empty/null courseId (legacy)
 * - License keys without courseId
 * - Batches marked as demo
 * 
 * Usage: npx tsx src/scripts/diagnoseBatchAccess.ts
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI!;

async function run() {
  console.log("\n🔍 Diagnosing Multi-Course Access Bug\n");
  await mongoose.connect(MONGO_URI);
  console.log("  Connected to DB\n");

  const db = mongoose.connection.db!;

  // 1. Find verified payments WITHOUT courseId
  const paymentsNoCourse = await db.collection("paymentsubmissions").countDocuments({
    status: "VERIFIED",
    $or: [{ courseId: { $exists: false } }, { courseId: null }, { courseId: "" }],
    kind: { $ne: "SHOP" },
  });
  console.log(`  📋 Verified payments WITHOUT courseId: ${paymentsNoCourse}`);
  if (paymentsNoCourse > 0) {
    const samples = await db.collection("paymentsubmissions").find({
      status: "VERIFIED",
      $or: [{ courseId: { $exists: false } }, { courseId: null }, { courseId: "" }],
      kind: { $ne: "SHOP" },
    }).limit(5).project({ _id: 1, studentId: 1, batchId: 1, courseId: 1, status: 1, createdAt: 1 }).toArray();
    console.log("     Samples:", JSON.stringify(samples, null, 2).slice(0, 500));
  }

  // 2. Find license keys without proper courseId
  const keysNoCourse = await db.collection("licensekeys").countDocuments({
    usedByStudentId: { $exists: true, $ne: null },
    $or: [{ courseId: { $exists: false } }, { courseId: null }, { courseId: "" }],
  });
  console.log(`  🔑 Used license keys WITHOUT courseId: ${keysNoCourse}`);

  // 3. Find multi-course batches (batches with >1 course snapshot)
  const multiCourseBatches = await db.collection("batches").find({
    "courseSnapshots.1": { $exists: true }, // has 2+ snapshots
    status: { $ne: "ARCHIVED" },
  }).project({ _id: 1, name: 1, batchId: 1, "courseSnapshots.courseId": 1, "courseSnapshots.title": 1, "courseSnapshots.isDemo": 1 }).toArray();
  console.log(`  📦 Active multi-course batches: ${multiCourseBatches.length}`);
  for (const b of multiCourseBatches.slice(0, 10)) {
    const courses = (b.courseSnapshots ?? []).map((s: { courseId?: string; title?: string; isDemo?: boolean }) => 
      `${s.courseId ?? "?"} "${s.title ?? "?"}" ${s.isDemo ? "(DEMO)" : "(PAID)"}`
    );
    console.log(`     Batch "${b.name}" (${b.batchId ?? b._id}):`);
    courses.forEach((c: string) => console.log(`       - ${c}`));
  }

  // 4. Check for enrollments in multi-course batches that have payments for only SOME courses
  if (multiCourseBatches.length > 0) {
    console.log("\n  🧪 Checking access leakage in multi-course batches...");
    for (const batch of multiCourseBatches.slice(0, 5)) {
      const batchId = String(batch._id);
      const courseIds = (batch.courseSnapshots ?? []).map((s: { courseId?: string }) => s.courseId).filter(Boolean);
      if (courseIds.length < 2) continue;

      // Find students enrolled in this batch
      const enrollments = await db.collection("enrollments").find({
        batchId,
        status: { $in: ["ACTIVE", "COMPLETED"] },
      }).project({ studentId: 1 }).limit(20).toArray();

      for (const e of enrollments.slice(0, 5)) {
        const studentId = e.studentId;
        // Check which courses this student has payments for
        const payments = await db.collection("paymentsubmissions").find({
          studentId,
          batchId,
          status: "VERIFIED",
          kind: { $ne: "SHOP" },
        }).project({ courseId: 1 }).toArray();

        const paidCourseIds = new Set(payments.map((p) => p.courseId).filter(Boolean));
        // Check license keys too
        const keys = await db.collection("licensekeys").find({
          usedByStudentId: studentId,
          batchId,
        }).project({ courseId: 1 }).toArray();
        const keyCourseIds = new Set(keys.map((k) => k.courseId).filter(Boolean));

        const allAccessCourseIds = new Set([...paidCourseIds, ...keyCourseIds]);
        const unpaidCourses = courseIds.filter((cid: string) => !allAccessCourseIds.has(cid));

        if (allAccessCourseIds.size > 0 && unpaidCourses.length > 0) {
          console.log(`     ⚠️  Student ${studentId} in batch "${batch.name}":`);
          console.log(`        Paid/keyed for: ${[...allAccessCourseIds].join(", ")}`);
          console.log(`        NOT paid for: ${unpaidCourses.join(", ")}`);
          // Check if any "no courseId" payments exist
          const blanks = payments.filter((p) => !p.courseId);
          if (blanks.length > 0) {
            console.log(`        🐛 Has ${blanks.length} payment(s) WITHOUT courseId — THIS COULD GRANT BATCH-WIDE ACCESS`);
          }
        }
      }
    }
  }

  await mongoose.disconnect();
  console.log("\n  Done.\n");
}

run().catch((err) => { console.error(err); process.exit(1); });
