/**
 * Franchise Report Service — generates CSV data for franchise performance reports.
 */

import { FranchiseCenterModel } from "../models/FranchiseCenter.model.js";
import { FranchiseTransactionModel } from "../models/FranchiseTransaction.model.js";
import { FranchiseKeyPoolModel } from "../models/FranchiseKeyPool.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { UserModel } from "../models/User.model.js";
import { CourseModel } from "../models/Course.model.js";
import { AppError } from "../utils/AppError.js";

export async function generateFranchiseReport(franchiseId: string) {
  const center = await FranchiseCenterModel.findById(franchiseId).lean().exec();
  if (!center) throw new AppError("Franchise center not found", 404);

  // Key pools
  const pools = await FranchiseKeyPoolModel.find({ franchiseId }).lean().exec();
  const courseIds = pools.map((p) => p.courseId);
  const courses = courseIds.length > 0
    ? await CourseModel.find({
        $or: [{ courseId: { $in: courseIds } }, { _id: { $in: courseIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)) } }],
      }).select("courseId title").lean().exec()
    : [];
  const titleMap = new Map<string, string>();
  for (const c of courses) {
    if ((c as { courseId?: string }).courseId) titleMap.set((c as { courseId?: string }).courseId!, c.title);
    titleMap.set(String(c._id), c.title);
  }

  // Enrollments
  const enrollments = await EnrollmentModel.find({ franchiseId }).lean().exec();
  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const students = studentIds.length > 0
    ? await UserModel.find({ _id: { $in: studentIds } }).select("name username mobile").lean().exec()
    : [];

  // Transactions
  const transactions = await FranchiseTransactionModel.find({ franchiseId })
    .sort({ createdAt: -1 }).lean().exec();

  let totalRevenue = 0;
  let totalCommission = 0;
  let totalPayouts = 0;
  for (const txn of transactions) {
    if (txn.direction === "CREDIT") {
      if (txn.type === "COMMISSION") totalCommission += txn.amountPaise;
      else totalRevenue += txn.amountPaise;
    }
    if (txn.direction === "DEBIT" && txn.type === "PAYOUT") totalPayouts += txn.amountPaise;
  }

  // Build CSV
  const lines: string[] = [];
  lines.push("FUNT Robotics — Franchise Report");
  lines.push(`Franchise: ${center.centerName} (${center.franchiseCode})`);
  lines.push(`City: ${center.city}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("=== SUMMARY ===");
  lines.push(`Total Students: ${studentIds.length}`);
  lines.push(`Total Enrollments: ${enrollments.length}`);
  lines.push(`Total Revenue Collected: ₹${(totalRevenue / 100).toFixed(2)}`);
  lines.push(`Total Commission Earned: ₹${(totalCommission / 100).toFixed(2)}`);
  lines.push(`Total Payouts: ₹${(totalPayouts / 100).toFixed(2)}`);
  lines.push(`Pending Payout: ₹${((totalCommission - totalPayouts) / 100).toFixed(2)}`);
  lines.push("");
  lines.push("=== LICENSE KEY POOLS ===");
  lines.push("Course,Total Allocated,Total Used,Available");
  for (const pool of pools) {
    const title = titleMap.get(pool.courseId) ?? pool.courseId;
    lines.push(`${title},${pool.totalAllocated},${pool.totalUsed},${pool.totalAllocated - pool.totalUsed}`);
  }
  lines.push("");
  lines.push("=== STUDENTS ===");
  lines.push("Name,Username,Mobile");
  for (const s of students) {
    lines.push(`${(s as { name?: string }).name ?? ""},${(s as { username?: string }).username ?? ""},${(s as { mobile?: string }).mobile ?? ""}`);
  }
  lines.push("");
  lines.push("=== TRANSACTIONS (last 100) ===");
  lines.push("Date,Type,Direction,Amount (₹),Note");
  for (const txn of transactions.slice(0, 100)) {
    const date = (txn as { createdAt?: Date }).createdAt
      ? new Date((txn as { createdAt?: Date }).createdAt!).toLocaleDateString()
      : "";
    lines.push(`${date},${txn.type},${txn.direction},${(txn.amountPaise / 100).toFixed(2)},"${txn.note ?? ""}"`);
  }

  return {
    csv: lines.join("\n"),
    filename: `franchise-report-${center.franchiseCode}-${new Date().toISOString().slice(0, 10)}.csv`,
    summary: {
      centerName: center.centerName,
      franchiseCode: center.franchiseCode,
      totalStudents: studentIds.length,
      totalEnrollments: enrollments.length,
      totalRevenuePaise: totalRevenue,
      totalCommissionPaise: totalCommission,
      totalPayoutsPaise: totalPayouts,
      pendingPayoutPaise: totalCommission - totalPayouts,
      keyPools: pools.map((p) => ({
        courseId: p.courseId,
        courseTitle: titleMap.get(p.courseId) ?? p.courseId,
        totalAllocated: p.totalAllocated,
        totalUsed: p.totalUsed,
        available: p.totalAllocated - p.totalUsed,
      })),
    },
  };
}
