/**
 * Batch Analytics Service
 * Per-batch: completion rate, avg quiz score, dropout chapters, time-to-complete.
 */

import { EnrollmentModel } from "../models/Enrollment.model.js";
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { QuizAttemptModel } from "../models/QuizAttempt.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { AppError } from "../utils/AppError.js";
import { ENROLLMENT_STATUS, QUIZ_ATTEMPT_STATUS } from "@funt-platform/constants";

export async function getBatchAnalytics(batchId: string) {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const firstSnap = snapshots[0] as { courseId?: string; modules?: unknown[] } | undefined;
  const courseId = firstSnap?.courseId ?? batchMongoId;
  const totalChapters = Array.isArray(firstSnap?.modules) ? firstSnap.modules.length : 0;

  // Get all enrollments for this batch
  const enrollments = await EnrollmentModel.find({
    batchId: batchMongoId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
  }).lean().exec();

  const studentIds = enrollments.map((e) => e.studentId);
  const totalStudents = studentIds.length;

  if (totalStudents === 0) {
    return {
      batchId: batchMongoId,
      courseId,
      totalStudents: 0,
      totalChapters,
      completionRate: 0,
      avgProgressPercent: 0,
      avgQuizScore: 0,
      dropoutChapters: [],
      avgTimeToCompleteHours: 0,
    };
  }

  // Get all chapter progress for students in this batch
  const allProgress = await ChapterProgressModel.find({
    studentId: { $in: studentIds },
    batchId: batchMongoId,
  }).lean().exec();

  // Compute per-student completion
  const completionByStudent = new Map<string, number>();
  for (const p of allProgress) {
    if (!(p as { completedAt?: Date }).completedAt) continue;
    const sid = p.studentId;
    completionByStudent.set(sid, (completionByStudent.get(sid) ?? 0) + 1);
  }

  // Students who completed ALL chapters
  const fullyCompletedCount = [...completionByStudent.values()].filter((c) => c >= totalChapters).length;
  const completionRate = totalStudents > 0 ? Math.round((fullyCompletedCount / totalStudents) * 100) : 0;

  // Average progress percent
  const avgProgress = totalStudents > 0
    ? Math.round([...completionByStudent.values()].reduce((s, c) => s + Math.min(100, Math.round((c / Math.max(1, totalChapters)) * 100)), 0) / totalStudents)
    : 0;

  // Dropout chapters — find which chapters have the biggest drop-off
  const chapterCompletionCounts = new Map<number, number>();
  for (const p of allProgress) {
    if (!(p as { completedAt?: Date }).completedAt) continue;
    const order = (p as { moduleOrder: number }).moduleOrder;
    chapterCompletionCounts.set(order, (chapterCompletionCounts.get(order) ?? 0) + 1);
  }

  const dropoutChapters: Array<{ chapterOrder: number; completedBy: number; dropoffPercent: number }> = [];
  for (let i = 1; i < totalChapters; i++) {
    const prevCount = chapterCompletionCounts.get(i - 1) ?? 0;
    const currCount = chapterCompletionCounts.get(i) ?? 0;
    if (prevCount > 0 && currCount < prevCount) {
      const dropoff = Math.round(((prevCount - currCount) / prevCount) * 100);
      if (dropoff >= 20) { // Only report significant dropoffs (20%+)
        dropoutChapters.push({ chapterOrder: i, completedBy: currCount, dropoffPercent: dropoff });
      }
    }
  }
  dropoutChapters.sort((a, b) => b.dropoffPercent - a.dropoffPercent);

  // Average quiz score
  const quizAttempts = await QuizAttemptModel.find({
    studentId: { $in: studentIds },
    batchId: batchMongoId,
    status: QUIZ_ATTEMPT_STATUS.COMPLETED,
    isPractice: { $ne: true },
  }).select("scorePercent startedAt completedAt").lean().exec();

  const avgQuizScore = quizAttempts.length > 0
    ? Math.round(quizAttempts.reduce((s, a) => s + ((a as { scorePercent: number }).scorePercent ?? 0), 0) / quizAttempts.length)
    : 0;

  // Average time to complete (for students who completed all chapters)
  let avgTimeToCompleteHours = 0;
  if (fullyCompletedCount > 0) {
    const completedStudents = enrollments.filter((e) =>
      (completionByStudent.get(e.studentId) ?? 0) >= totalChapters
    );
    const times: number[] = [];
    for (const e of completedStudents) {
      const studentProgress = allProgress
        .filter((p) => p.studentId === e.studentId && (p as { completedAt?: Date }).completedAt)
        .map((p) => new Date((p as { completedAt: Date }).completedAt).getTime());
      if (studentProgress.length > 0) {
        const enrolledAt = new Date((e as { enrolledAt?: Date }).enrolledAt ?? (e as { createdAt?: Date }).createdAt ?? Date.now()).getTime();
        const lastCompleted = Math.max(...studentProgress);
        times.push((lastCompleted - enrolledAt) / (1000 * 60 * 60)); // hours
      }
    }
    if (times.length > 0) {
      avgTimeToCompleteHours = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    }
  }

  return {
    batchId: batchMongoId,
    courseId,
    totalStudents,
    totalChapters,
    completionRate,
    avgProgressPercent: avgProgress,
    avgQuizScore,
    dropoutChapters: dropoutChapters.slice(0, 5), // Top 5 dropout points
    avgTimeToCompleteHours,
  };
}
