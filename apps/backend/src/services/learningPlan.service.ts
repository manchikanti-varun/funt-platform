/**
 * Learning Plan Service
 *
 * Handles the full lifecycle of Learning Plan milestones:
 *   - Course milestone configuration (CRUD)
 *   - Batch snapshot propagation
 *   - Chapter access gating
 *   - Milestone progress recalculation (reuses ChapterProgress — no duplicate tracking)
 *   - Unlock via payment / license key / manual / free / date-based
 *   - Enrollment currentMilestoneId / nextEligibleMilestoneId maintenance
 *   - Analytics
 *
 * Backward compat: if deliveryMode = FULL_ACCESS → zero impact on existing logic.
 */

import {
  COURSE_DELIVERY_MODE,
  MILESTONE_UNLOCK_TYPE,
  MILESTONE_COMPLETION_RULE,
  MILESTONE_UNLOCK_SOURCE,
  MILESTONE_PAYMENT_STATUS,
} from "@funt-platform/constants";
import { CourseModel } from "../models/Course.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { EnrollmentModel } from "../models/Enrollment.model.js";
import { MilestoneProgressModel } from "../models/MilestoneProgress.model.js";
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { CertificateModel } from "../models/Certificate.model.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";
import { PaymentSubmissionModel } from "../models/PaymentSubmission.model.js";
import { findBatchByParam, getBatchCourseSnapshots } from "./batch.service.js";
import { createAuditLog } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { AppError } from "../utils/AppError.js";
import { generateMilestoneId, generateCertificateId } from "../utils/funtIdGenerator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MilestoneInput {
  title: string;
  description?: string;
  order: number;
  feeInPaise?: number;
  unlockType?: string;
  completionRule?: string;
  unlockAfterDate?: string;
  unlockAfterDays?: number;
  paymentDueInDays?: number;
  certificateEligible?: boolean;
  active?: boolean;
  chapterOrders?: number[];
}

interface MilestoneLike {
  milestoneId: string;
  title: string;
  description?: string;
  order: number;
  feeInPaise: number;
  unlockType: string;
  completionRule: string;
  unlockAfterDate?: Date;
  unlockAfterDays?: number;
  paymentDueInDays?: number;
  certificateEligible: boolean;
  active: boolean;
  chapterOrders: number[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCourseDoc(courseIdParam: string) {
  const doc = await CourseModel.findOne({
    $or: [{ courseId: courseIdParam }, { _id: /^[a-f\d]{24}$/i.test(courseIdParam) ? courseIdParam : "000000000000" }],
  }).exec();
  if (!doc) throw new AppError("Course not found", 404);
  return doc;
}

function getMilestonesFromSnapshot(snapshot: unknown): MilestoneLike[] {
  const lp = (snapshot as { learningPlan?: { milestones?: MilestoneLike[] } })?.learningPlan;
  return Array.isArray(lp?.milestones) ? (lp.milestones as MilestoneLike[]) : [];
}

function getLearningPlanFromSnapshot(snapshot: unknown) {
  return (snapshot as { learningPlan?: { enabled?: boolean; autoLockPreviousMilestones?: boolean; milestones?: MilestoneLike[] } })?.learningPlan;
}

function isLearningPlanActive(snapshot: unknown): boolean {
  const lp = getLearningPlanFromSnapshot(snapshot);
  const mode = (snapshot as { deliveryMode?: string })?.deliveryMode;
  return (
    mode === COURSE_DELIVERY_MODE.LEARNING_PLAN &&
    !!lp?.enabled &&
    Array.isArray(lp.milestones) &&
    lp.milestones.length > 0
  );
}

function findMilestoneForChapter(milestones: MilestoneLike[], chapterOrder: number): MilestoneLike | null {
  return milestones.find((m) => m.active && Array.isArray(m.chapterOrders) && m.chapterOrders.includes(chapterOrder)) ?? null;
}

function orderedActiveMilestones(milestones: MilestoneLike[]): MilestoneLike[] {
  return [...milestones].filter((m) => m.active).sort((a, b) => a.order - b.order);
}

// ─── Course milestone configuration ─────────────────────────────────────────

export async function saveLearningPlan(
  courseIdParam: string,
  input: {
    enabled: boolean;
    autoLockPreviousMilestones: boolean;
    milestones: MilestoneInput[];
  },
  actorId: string
) {
  const course = await getCourseDoc(courseIdParam);

  // Generate stable milestoneIds for new milestones
  const existing = (course.get("learningPlan.milestones") ?? []) as MilestoneLike[];
  const existingMap = new Map(existing.map((m) => [m.milestoneId, m]));

  const milestones: MilestoneLike[] = [];
  for (const m of input.milestones) {
    // Preserve milestoneId if it already exists (matched by order+title heuristic won't work — admin must pass milestoneId back)
    // New milestones get generated IDs
    const existingEntry = existing.find((e) => e.title === m.title && e.order === m.order);
    const milestoneId = existingEntry?.milestoneId ?? await generateMilestoneId();
    milestones.push({
      milestoneId,
      title: m.title.trim(),
      description: m.description?.trim() ?? "",
      order: m.order,
      feeInPaise: Math.max(0, Math.floor(Number(m.feeInPaise ?? 0))),
      unlockType: m.unlockType ?? MILESTONE_UNLOCK_TYPE.PAYMENT_AFTER_COMPLETION,
      completionRule: m.completionRule ?? MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS,
      unlockAfterDate: m.unlockAfterDate ? new Date(m.unlockAfterDate) : undefined,
      unlockAfterDays: m.unlockAfterDays,
      paymentDueInDays: m.paymentDueInDays,
      certificateEligible: m.certificateEligible ?? false,
      active: m.active ?? true,
      chapterOrders: Array.isArray(m.chapterOrders) ? m.chapterOrders : [],
    });
  }

  course.set("deliveryMode", input.enabled ? COURSE_DELIVERY_MODE.LEARNING_PLAN : COURSE_DELIVERY_MODE.FULL_ACCESS);
  course.set("learningPlan", { enabled: input.enabled, autoLockPreviousMilestones: input.autoLockPreviousMilestones, milestones });
  await course.save();

  void existingMap; // suppress unused warning

  await createAuditLog("LEARNING_PLAN_CONFIGURED", actorId, "Course", String(course._id), {
    enabled: input.enabled,
    milestoneCount: milestones.length,
  });

  return { courseId: course.get("courseId"), learningPlan: course.get("learningPlan") };
}

/**
 * Save a milestone with a pre-existing milestoneId (used by admin UI that
 * sends back the ID it received from the server).
 */
export async function upsertMilestone(
  courseIdParam: string,
  milestoneId: string | null,
  input: MilestoneInput,
  actorId: string
) {
  const course = await getCourseDoc(courseIdParam);
  const milestones = ((course.get("learningPlan.milestones") ?? []) as MilestoneLike[]).slice();

  const isNew = !milestoneId || !milestones.some((m) => m.milestoneId === milestoneId);
  const resolvedId = isNew ? await generateMilestoneId() : milestoneId!;

  const entry: MilestoneLike = {
    milestoneId: resolvedId,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    order: input.order,
    feeInPaise: Math.max(0, Math.floor(Number(input.feeInPaise ?? 0))),
    unlockType: input.unlockType ?? MILESTONE_UNLOCK_TYPE.PAYMENT_AFTER_COMPLETION,
    completionRule: input.completionRule ?? MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS,
    unlockAfterDate: input.unlockAfterDate ? new Date(input.unlockAfterDate) : undefined,
    unlockAfterDays: input.unlockAfterDays,
    paymentDueInDays: input.paymentDueInDays,
    certificateEligible: input.certificateEligible ?? false,
    active: input.active ?? true,
    chapterOrders: Array.isArray(input.chapterOrders) ? input.chapterOrders : [],
  };

  if (isNew) {
    milestones.push(entry);
  } else {
    const idx = milestones.findIndex((m) => m.milestoneId === resolvedId);
    milestones[idx] = entry;
  }

  course.set("learningPlan.milestones", milestones);
  await course.save();

  await createAuditLog(
    isNew ? "MILESTONE_CREATED" : "MILESTONE_UPDATED",
    actorId,
    "Course",
    String(course._id),
    { milestoneId: resolvedId, title: entry.title }
  );

  return entry;
}

export async function deleteMilestone(courseIdParam: string, milestoneId: string, actorId: string) {
  const course = await getCourseDoc(courseIdParam);
  const milestones = ((course.get("learningPlan.milestones") ?? []) as MilestoneLike[]).filter(
    (m) => m.milestoneId !== milestoneId
  );
  // Check no student has progress on this milestone
  const hasProgress = await MilestoneProgressModel.exists({ milestoneId }).exec();
  if (hasProgress) {
    throw new AppError(
      "Cannot delete milestone — students already have progress on it. Archive it instead by setting active=false.",
      400
    );
  }
  course.set("learningPlan.milestones", milestones);
  await course.save();
  await createAuditLog("MILESTONE_DELETED", actorId, "Course", String(course._id), { milestoneId });
  return { deleted: true };
}

// ─── Batch snapshot sync ──────────────────────────────────────────────────────

/**
 * Push the course's current learningPlan config into a specific batch snapshot.
 * Called when admin creates a new batch OR explicitly "syncs" a batch.
 * Existing MilestoneProgress docs for enrolled students are preserved.
 */
export async function syncLearningPlanToBatch(courseIdParam: string, batchId: string, _actorId: string) {
  const course = await getCourseDoc(courseIdParam);
  const lp = course.get("learningPlan");
  const deliveryMode = course.get("deliveryMode");

  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);

  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snapIdx = snaps.findIndex((s) => (s as { courseId?: string }).courseId === courseIdParam);
  if (snapIdx === -1) throw new AppError("Course not in this batch", 400);

  // Update the snapshot in place
  const batchDoc = await BatchModel.findById(batchMongoId).exec();
  if (!batchDoc) throw new AppError("Batch not found", 404);

  const snapField = Array.isArray((batchDoc as { courseSnapshots?: unknown[] }).courseSnapshots) && (batchDoc as { courseSnapshots?: unknown[] }).courseSnapshots!.length > 0
    ? "courseSnapshots"
    : "courseSnapshot";

  if (snapField === "courseSnapshots") {
    const arr = (batchDoc as unknown as { courseSnapshots: Record<string, unknown>[] }).courseSnapshots;
    const idx = arr.findIndex((s) => s.courseId === courseIdParam);
    if (idx !== -1) {
      arr[idx].deliveryMode = deliveryMode;
      arr[idx].learningPlan = lp;
      batchDoc.markModified("courseSnapshots");
    }
  } else {
    (batchDoc as { courseSnapshot: Record<string, unknown> }).courseSnapshot.deliveryMode = deliveryMode;
    (batchDoc as { courseSnapshot: Record<string, unknown> }).courseSnapshot.learningPlan = lp;
    batchDoc.markModified("courseSnapshot");
  }

  await batchDoc.save();
  return { synced: true, batchId: batchMongoId };
}

// ─── Chapter access gate ──────────────────────────────────────────────────────

/**
 * Returns true when a student can access a chapter.
 * FULL_ACCESS courses: always returns true (caller handles enrollment check).
 * LEARNING_PLAN courses: checks milestone unlock state.
 */
export async function canStudentAccessChapter(
  studentId: string,
  batchId: string,
  courseId: string,
  chapterOrder: number,
  courseSnapshot: unknown
): Promise<{ allowed: boolean; reason?: string; milestoneId?: string }> {
  if (!isLearningPlanActive(courseSnapshot)) {
    return { allowed: true };
  }

  const milestones = getMilestonesFromSnapshot(courseSnapshot);
  const milestone = findMilestoneForChapter(milestones, chapterOrder);

  if (!milestone) {
    // Chapter not assigned to any milestone — allow (admin oversight)
    return { allowed: true };
  }

  const progress = await MilestoneProgressModel.findOne({
    studentId,
    batchId,
    courseId,
    milestoneId: milestone.milestoneId,
  })
    .select("unlocked locked")
    .lean()
    .exec();

  if (!progress || !(progress as { unlocked?: boolean }).unlocked) {
    return {
      allowed: false,
      reason: `Chapter is locked. Unlock "${milestone.title}" to access this content.`,
      milestoneId: milestone.milestoneId,
    };
  }

  if ((progress as { locked?: boolean }).locked) {
    return {
      allowed: false,
      reason: `Access to "${milestone.title}" has been revoked by an administrator.`,
      milestoneId: milestone.milestoneId,
    };
  }

  // autoLockPreviousMilestones: check if this milestone is before the current one
  const lp = getLearningPlanFromSnapshot(courseSnapshot);
  if (lp?.autoLockPreviousMilestones) {
    const enrollment = await EnrollmentModel.findOne({ studentId, batchId })
      .select("currentMilestoneId")
      .lean()
      .exec();
    const currentId = (enrollment as { currentMilestoneId?: string } | null)?.currentMilestoneId;
    if (currentId && currentId !== milestone.milestoneId) {
      const ordered = orderedActiveMilestones(milestones);
      const currentIdx = ordered.findIndex((m) => m.milestoneId === currentId);
      const thisIdx = ordered.findIndex((m) => m.milestoneId === milestone.milestoneId);
      if (thisIdx < currentIdx) {
        return {
          allowed: false,
          reason: `"${milestone.title}" is a previous milestone and is no longer accessible.`,
          milestoneId: milestone.milestoneId,
        };
      }
    }
  }

  return { allowed: true, milestoneId: milestone.milestoneId };
}

/**
 * Batch-check chapter access for ALL chapters in a course using pre-loaded data.
 * Single DB round-trip instead of N per-chapter queries.
 * Used by getBatchCourseForStudent when learning plan is active.
 */
export async function batchCheckChapterAccess(
  studentId: string,
  batchId: string,
  courseId: string,
  chapterOrders: number[],
  courseSnapshot: unknown
): Promise<Map<number, { allowed: boolean; reason?: string; milestoneId?: string }>> {
  const result = new Map<number, { allowed: boolean; reason?: string; milestoneId?: string }>();

  if (!isLearningPlanActive(courseSnapshot)) {
    for (const order of chapterOrders) result.set(order, { allowed: true });
    return result;
  }

  const milestones = getMilestonesFromSnapshot(courseSnapshot);

  // Pre-load ALL milestone progress for this student+batch+course in one query
  const allProgress = await MilestoneProgressModel.find({
    studentId,
    batchId,
    courseId,
  })
    .select("milestoneId unlocked locked")
    .lean()
    .exec();
  const progressByMilestoneId = new Map(
    allProgress.map((p) => [
      (p as { milestoneId: string }).milestoneId,
      { unlocked: !!(p as { unlocked?: boolean }).unlocked, locked: !!(p as { locked?: boolean }).locked },
    ])
  );

  // Pre-load enrollment for autoLock check (one query)
  const lp = getLearningPlanFromSnapshot(courseSnapshot);
  let currentMilestoneId: string | undefined;
  let ordered: MilestoneLike[] | undefined;
  if (lp?.autoLockPreviousMilestones) {
    const enrollment = await EnrollmentModel.findOne({ studentId, batchId })
      .select("currentMilestoneId")
      .lean()
      .exec();
    currentMilestoneId = (enrollment as { currentMilestoneId?: string } | null)?.currentMilestoneId ?? undefined;
    ordered = orderedActiveMilestones(milestones);
  }

  for (const chapterOrder of chapterOrders) {
    const milestone = findMilestoneForChapter(milestones, chapterOrder);
    if (!milestone) {
      result.set(chapterOrder, { allowed: true });
      continue;
    }

    const progress = progressByMilestoneId.get(milestone.milestoneId);
    if (!progress || !progress.unlocked) {
      result.set(chapterOrder, {
        allowed: false,
        reason: `Chapter is locked. Unlock "${milestone.title}" to access this content.`,
        milestoneId: milestone.milestoneId,
      });
      continue;
    }

    if (progress.locked) {
      result.set(chapterOrder, {
        allowed: false,
        reason: `Access to "${milestone.title}" has been revoked by an administrator.`,
        milestoneId: milestone.milestoneId,
      });
      continue;
    }

    // autoLockPreviousMilestones check
    if (lp?.autoLockPreviousMilestones && currentMilestoneId && currentMilestoneId !== milestone.milestoneId && ordered) {
      const currentIdx = ordered.findIndex((m) => m.milestoneId === currentMilestoneId);
      const thisIdx = ordered.findIndex((m) => m.milestoneId === milestone.milestoneId);
      if (thisIdx < currentIdx) {
        result.set(chapterOrder, {
          allowed: false,
          reason: `"${milestone.title}" is a previous milestone and is no longer accessible.`,
          milestoneId: milestone.milestoneId,
        });
        continue;
      }
    }

    result.set(chapterOrder, { allowed: true, milestoneId: milestone.milestoneId });
  }

  return result;
}

// ─── Milestone Progress recalculation ────────────────────────────────────────

/**
 * Recalculate completion percentage for a milestone.
 * Called after every chapter completion (hook in studentCourse.service.ts).
 * Reuses ChapterProgress — zero duplicate tracking.
 */
export async function recalculateMilestoneProgress(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  milestone: MilestoneLike
): Promise<void> {
  const progress = await MilestoneProgressModel.findOne({
    studentId,
    batchId,
    courseId,
    milestoneId,
  }).exec();

  if (!progress || !(progress as { unlocked?: boolean }).unlocked) return; // not unlocked yet

  const chapterOrders = Array.isArray(milestone.chapterOrders) ? milestone.chapterOrders : [];
  const totalChapters = chapterOrders.length;
  if (totalChapters === 0) return;

  const completedCount = await ChapterProgressModel.countDocuments({
    studentId,
    batchId,
    courseId,
    moduleOrder: { $in: chapterOrders },
    completedAt: { $exists: true, $ne: null },
  }).exec();

  const completionPct = Math.round((completedCount / totalChapters) * 100);

  // Check if completion rule is met
  let completed = false;
  switch (milestone.completionRule) {
    case MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS:
      completed = completedCount >= totalChapters;
      break;
    case MILESTONE_COMPLETION_RULE.COMPLETE_80_PERCENT:
      completed = completionPct >= 80;
      break;
    case MILESTONE_COMPLETION_RULE.COMPLETE_ASSIGNMENT: {
      // Milestone completes when all linked assignments in its chapters are APPROVED
      const batch = await findBatchByParam(batchId);
      const snaps = batch ? getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]) : [];
      const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
      const modules = (snap as { modules?: Array<{ order?: number; linkedAssignmentId?: string }> } | undefined)?.modules ?? [];
      const assignmentChapterOrders = chapterOrders.filter((order) => {
        const mod = modules.find((m) => (m.order ?? 0) === order);
        return !!mod?.linkedAssignmentId?.trim();
      });
      if (assignmentChapterOrders.length === 0) {
        // No assignments in this milestone — fall back to all chapters completed
        completed = completedCount >= totalChapters;
      } else {
        const approvedCount = await AssignmentSubmissionModel.countDocuments({
          studentId,
          batchId,
          courseId,
          moduleOrder: { $in: assignmentChapterOrders },
          status: "APPROVED",
        }).exec();
        completed = approvedCount >= assignmentChapterOrders.length;
      }
      break;
    }
    case MILESTONE_COMPLETION_RULE.MANUAL_APPROVAL:
      // Only admin can mark completed — don't auto-complete
      completed = !!(progress as { completed?: boolean }).completed;
      break;
    case MILESTONE_COMPLETION_RULE.PASS_MILESTONE_QUIZ: {
      // Milestone completes when all chapters are done AND the milestone quiz is passed
      const chaptersAllDone = completedCount >= totalChapters;
      if (chaptersAllDone && (milestone as { milestoneQuizId?: string }).milestoneQuizId) {
        const { hasStudentPassedQuiz } = await import("./quiz.service.js");
        const quizPassed = await hasStudentPassedQuiz(
          studentId,
          (milestone as { milestoneQuizId?: string }).milestoneQuizId!,
          batchId,
          courseId,
          undefined,
          milestone.milestoneId
        );
        completed = quizPassed;
      } else if (chaptersAllDone && !(milestone as { milestoneQuizId?: string }).milestoneQuizId) {
        // No quiz linked — fall back to chapters
        completed = true;
      } else {
        completed = false;
      }
      break;
    }
  }

  const wasCompleted = !!(progress as { completed?: boolean }).completed;
  const wasEligible = !!(progress as { eligibleForNext?: boolean }).eligibleForNext;

  await MilestoneProgressModel.updateOne(
    { _id: (progress as { _id: unknown })._id },
    {
      $set: {
        completedChapters: completedCount,
        totalChapters,
        completionPct,
        completed,
        completedAt: completed && !wasCompleted ? new Date() : (progress as { completedAt?: Date }).completedAt,
        eligibleForNext: completed,
        eligibleAt: completed && !wasEligible ? new Date() : (progress as { eligibleAt?: Date }).eligibleAt,
      },
    }
  ).exec();

  // Update enrollment pointers + send notifications on first completion
  if (completed && !wasCompleted) {
    await onMilestoneCompleted(studentId, batchId, courseId, milestoneId, milestone);
  }
}

async function onMilestoneCompleted(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  milestone: MilestoneLike
) {
  await createAuditLog("MILESTONE_COMPLETED", studentId, "MilestoneProgress", milestoneId, {
    studentId,
    batchId,
    courseId,
    milestoneTitle: milestone.title,
  });

  // Issue milestone certificate if eligible
  if (milestone.certificateEligible) {
    const existing = await CertificateModel.findOne({ studentId, batchId, milestoneId }).lean().exec();
    if (!existing) {
      const certId = await generateCertificateId();
      await CertificateModel.create({
        certificateId: certId,
        studentId,
        courseId,
        batchId,
        issuedAt: new Date(),
        issuedBy: "system",
        status: "ISSUED",
        coinReward: 0,
        milestoneId,
        milestoneTitle: milestone.title,
      });
      await MilestoneProgressModel.updateOne(
        { studentId, batchId, courseId, milestoneId },
        { $set: { milestoneCertificateId: certId } }
      ).exec();
    }
  }

  // Find next milestone and update enrollment
  const batch = await findBatchByParam(batchId);
  if (!batch) return;
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) return;

  const milestones = getMilestonesFromSnapshot(snap);
  const ordered = orderedActiveMilestones(milestones);
  const thisIdx = ordered.findIndex((m) => m.milestoneId === milestoneId);
  const nextMilestone = thisIdx >= 0 ? ordered[thisIdx + 1] : null;

  const enrollmentUpdate: Record<string, unknown> = {
    nextEligibleMilestoneId: nextMilestone?.milestoneId ?? null,
  };
  await EnrollmentModel.updateOne({ studentId, batchId }, { $set: enrollmentUpdate }).exec();

  // Notify student
  await createNotification({
    userId: studentId,
    title: `🎉 "${milestone.title}" Completed!`,
    body: nextMilestone
      ? `You've completed ${milestone.title}. You're now eligible to unlock ${nextMilestone.title}.`
      : `You've completed ${milestone.title}. Congratulations on finishing the program!`,
    type: "MILESTONE_COMPLETED",
    referenceId: milestoneId,
  });

  // ── Last milestone completed → auto-issue program certificate ──────────
  if (!nextMilestone) {
    try {
      const { generateCertificate } = await import("./certificate.service.js");
      await generateCertificate(studentId, batchId, "system");
    } catch {
      // Eligibility check may fail (e.g. not all chapters done due to 80% rule, or cert already issued)
      // Non-blocking — student can still claim manually later
    }
  }

  // Auto-unlock next milestone if it's FREE
  if (nextMilestone && nextMilestone.unlockType === MILESTONE_UNLOCK_TYPE.FREE && nextMilestone.feeInPaise === 0) {
    await unlockMilestone({
      studentId,
      batchId,
      courseId,
      milestoneId: nextMilestone.milestoneId,
      milestone: nextMilestone,
      source: MILESTONE_UNLOCK_SOURCE.FREE,
      actorId: "system",
    });
  }

  // Schedule RELATIVE_DATE next milestone
  if (nextMilestone && nextMilestone.unlockType === MILESTONE_UNLOCK_TYPE.RELATIVE_DATE && nextMilestone.unlockAfterDays) {
    const enrollment = await EnrollmentModel.findOne({ studentId, batchId }).select("enrolledAt").lean().exec();
    const enrolledAt = (enrollment as { enrolledAt?: Date } | null)?.enrolledAt ?? new Date();
    const scheduledUnlockAt = new Date(enrolledAt.getTime() + nextMilestone.unlockAfterDays * 24 * 60 * 60 * 1000);
    await MilestoneProgressModel.updateOne(
      { studentId, batchId, courseId, milestoneId: nextMilestone.milestoneId },
      { $set: { scheduledUnlockAt } },
      { upsert: false }
    ).exec();
  }
}

// ─── Unlock milestone ─────────────────────────────────────────────────────────

interface UnlockMilestoneInput {
  studentId: string;
  batchId: string;
  courseId: string;
  milestoneId: string;
  milestone: MilestoneLike;
  source: string;
  actorId: string;
  paymentId?: string;
  licenseKeyId?: string;
  licenseKeyCode?: string;
}

export async function unlockMilestone(input: UnlockMilestoneInput): Promise<void> {
  const { studentId, batchId, courseId, milestoneId, milestone, source, actorId } = input;

  const now = new Date();

  // Compute payment due date
  let paymentDueAt: Date | undefined;
  if (milestone.paymentDueInDays) {
    paymentDueAt = new Date(now.getTime() + milestone.paymentDueInDays * 24 * 60 * 60 * 1000);
  }

  await MilestoneProgressModel.findOneAndUpdate(
    { studentId, batchId, courseId, milestoneId },
    {
      $set: {
        studentId, batchId, courseId, milestoneId,
        milestoneOrder: milestone.order,
        milestoneTitle: milestone.title,
        unlocked: true,
        unlockedAt: now,
        unlockSource: source,
        unlockedBy: actorId,
        locked: false,
        paymentId: input.paymentId,
        paidAt: input.paymentId ? now : undefined,
        licenseKeyId: input.licenseKeyId,
        licenseKeyCode: input.licenseKeyCode,
        paymentStatus: MILESTONE_PAYMENT_STATUS.ACTIVE,
        paymentDueAt,
        totalChapters: Array.isArray(milestone.chapterOrders) ? milestone.chapterOrders.length : 0,
      },
      $setOnInsert: {
        completedChapters: 0,
        completionPct: 0,
        completed: false,
        eligibleForNext: false,
      },
    },
    { upsert: true, new: true }
  ).exec();

  // Update enrollment currentMilestoneId if this is the first or a higher milestone
  const enrollment = await EnrollmentModel.findOne({ studentId, batchId })
    .select("currentMilestoneId learningPlanActive")
    .lean()
    .exec();

  const currentId = (enrollment as { currentMilestoneId?: string } | null)?.currentMilestoneId;

  // Determine if this milestone is "later" than the current one
  const batch = await findBatchByParam(batchId);
  if (batch) {
    const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
    const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
    if (snap) {
      const milestones = getMilestonesFromSnapshot(snap);
      const ordered = orderedActiveMilestones(milestones);
      const currentIdx = currentId ? ordered.findIndex((m) => m.milestoneId === currentId) : -1;
      const thisIdx = ordered.findIndex((m) => m.milestoneId === milestoneId);

      if (!currentId || thisIdx > currentIdx || !enrollment) {
        await EnrollmentModel.updateOne(
          { studentId, batchId },
          { $set: { currentMilestoneId: milestoneId, learningPlanActive: true } }
        ).exec();
      }
    }
  }

  await createAuditLog(
    source === MILESTONE_UNLOCK_SOURCE.MANUAL ? "MILESTONE_MANUAL_UNLOCK" :
    source === MILESTONE_UNLOCK_SOURCE.PAYMENT ? "MILESTONE_PAYMENT_UNLOCK" :
    source === MILESTONE_UNLOCK_SOURCE.LICENSE_KEY ? "MILESTONE_LICENSE_REDEEMED" :
    "MILESTONE_UNLOCKED",
    actorId,
    "MilestoneProgress",
    milestoneId,
    { studentId, batchId, courseId, source, milestoneTitle: milestone.title }
  );

  await createNotification({
    userId: studentId,
    title: `🔓 "${milestone.title}" Unlocked!`,
    body: `You now have access to ${milestone.title}. Start learning!`,
    type: "MILESTONE_UNLOCKED",
    referenceId: milestoneId,
  });
}

// ─── Initialize milestone progress for enrollment ─────────────────────────────

/**
 * Called when a student enrolls in a Learning Plan course.
 * Creates MilestoneProgress docs for all milestones (unlocked=false initially)
 * and auto-unlocks the first milestone if it's FREE.
 */
export async function initializeMilestoneProgress(
  studentId: string,
  batchId: string,
  courseId: string,
  milestones: MilestoneLike[],
  enrolledAt: Date
): Promise<void> {
  const ordered = orderedActiveMilestones(milestones);

  // Create progress docs for all milestones (unlocked=false)
  const ops = ordered.map((m) => ({
    updateOne: {
      filter: { studentId, batchId, courseId, milestoneId: m.milestoneId },
      update: {
        $setOnInsert: {
          studentId, batchId, courseId,
          milestoneId: m.milestoneId,
          milestoneOrder: m.order,
          milestoneTitle: m.title,
          unlocked: false,
          locked: false,
          completedChapters: 0,
          totalChapters: Array.isArray(m.chapterOrders) ? m.chapterOrders.length : 0,
          completionPct: 0,
          completed: false,
          eligibleForNext: false,
          paymentStatus: MILESTONE_PAYMENT_STATUS.ACTIVE,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await MilestoneProgressModel.bulkWrite(ops as Parameters<typeof MilestoneProgressModel.bulkWrite>[0]);
  }

  // Update enrollment flags
  await EnrollmentModel.updateOne(
    { studentId, batchId },
    {
      $set: {
        learningPlanActive: true,
        nextEligibleMilestoneId: ordered[0]?.milestoneId ?? null,
      },
    }
  ).exec();

  // Schedule RELATIVE_DATE unlocks
  for (const m of ordered) {
    if (m.unlockType === MILESTONE_UNLOCK_TYPE.RELATIVE_DATE && m.unlockAfterDays) {
      const scheduledUnlockAt = new Date(enrolledAt.getTime() + m.unlockAfterDays * 24 * 60 * 60 * 1000);
      await MilestoneProgressModel.updateOne(
        { studentId, batchId, courseId, milestoneId: m.milestoneId },
        { $set: { scheduledUnlockAt } }
      ).exec();
    }
  }

  // Auto-unlock first milestone if FREE
  const first = ordered[0];
  if (first && (first.unlockType === MILESTONE_UNLOCK_TYPE.FREE || first.feeInPaise === 0)) {
    await unlockMilestone({
      studentId, batchId, courseId,
      milestoneId: first.milestoneId,
      milestone: first,
      source: MILESTONE_UNLOCK_SOURCE.FREE,
      actorId: "system",
    });
  } else if (first) {
    // First milestone requires payment — mark it as eligible so the payment button appears
    await MilestoneProgressModel.updateOne(
      { studentId, batchId, courseId, milestoneId: first.milestoneId },
      { $set: { eligibleForNext: true, eligibleAt: new Date() } }
    ).exec();
  }
}

// ─── Payment unlock ───────────────────────────────────────────────────────────

export async function unlockMilestoneByPayment(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  paymentId: string,
  actorId: string
): Promise<void> {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) throw new AppError("Course not found in batch", 404);

  const milestones = getMilestonesFromSnapshot(snap);
  const milestone = milestones.find((m) => m.milestoneId === milestoneId);
  if (!milestone) throw new AppError("Milestone not found", 404);

  await unlockMilestone({
    studentId, batchId, courseId, milestoneId,
    milestone, source: MILESTONE_UNLOCK_SOURCE.PAYMENT,
    actorId, paymentId,
  });
}

/**
 * Unlock ALL milestones for a student via full program payment.
 * Bypasses progression — all milestones unlock immediately.
 */
export async function unlockAllMilestonesByPayment(
  studentId: string,
  batchId: string,
  courseId: string,
  paymentId: string,
  actorId: string
): Promise<void> {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) throw new AppError("Course not found in batch", 404);

  const milestones = getMilestonesFromSnapshot(snap);
  const ordered = orderedActiveMilestones(milestones);

  for (const milestone of ordered) {
    // Skip already unlocked milestones
    const existing = await MilestoneProgressModel.findOne({
      studentId, batchId, courseId, milestoneId: milestone.milestoneId,
    }).select("unlocked").lean().exec();
    if ((existing as { unlocked?: boolean } | null)?.unlocked) continue;

    await unlockMilestone({
      studentId, batchId, courseId,
      milestoneId: milestone.milestoneId,
      milestone,
      source: MILESTONE_UNLOCK_SOURCE.PAYMENT,
      actorId,
      paymentId,
    });
  }
}

// ─── License key unlock ───────────────────────────────────────────────────────

export async function unlockMilestonesByLicenseKey(
  studentId: string,
  batchId: string,
  courseId: string,
  licenseKeyId: string,
  licenseKeyCode: string,
  targetMilestoneIds: string[]
): Promise<void> {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) throw new AppError("Course not found in batch", 404);

  const milestones = getMilestonesFromSnapshot(snap);
  const ordered = orderedActiveMilestones(milestones);

  // Determine which milestones to unlock
  const toUnlock = targetMilestoneIds.length === 0
    ? ordered  // FULL_PLAN_ACCESS
    : ordered.filter((m) => targetMilestoneIds.includes(m.milestoneId));

  for (const milestone of toUnlock) {
    // FULL_PLAN_ACCESS and targeted milestone keys both bypass progression — unlock immediately
    await unlockMilestone({
      studentId, batchId, courseId,
      milestoneId: milestone.milestoneId,
      milestone,
      source: MILESTONE_UNLOCK_SOURCE.LICENSE_KEY,
      actorId: studentId,
      licenseKeyId,
      licenseKeyCode,
    });
  }

  await createNotification({
    userId: studentId,
    title: "License Key Redeemed",
    body: `Your license key has unlocked ${toUnlock.length} milestone(s).`,
    type: "GENERAL",
    referenceId: licenseKeyId,
  });
}

// ─── Admin controls ───────────────────────────────────────────────────────────

export async function adminUnlockMilestone(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  adminId: string,
  isScholarship = false
): Promise<void> {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  const milestones = getMilestonesFromSnapshot(snap);
  const milestone = milestones.find((m) => m.milestoneId === milestoneId);
  if (!milestone) throw new AppError("Milestone not found", 404);

  await unlockMilestone({
    studentId, batchId, courseId, milestoneId,
    milestone,
    source: MILESTONE_UNLOCK_SOURCE.MANUAL,
    actorId: adminId,
  });

  if (isScholarship) {
    await createAuditLog("MILESTONE_SCHOLARSHIP_GRANTED", adminId, "MilestoneProgress", milestoneId, {
      studentId, batchId, courseId,
    });
  }
}

export async function adminLockMilestone(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  adminId: string
): Promise<void> {
  await MilestoneProgressModel.updateOne(
    { studentId, batchId, courseId, milestoneId },
    { $set: { locked: true, lockedAt: new Date(), lockedBy: adminId } }
  ).exec();

  await createAuditLog("MILESTONE_LOCKED", adminId, "MilestoneProgress", milestoneId, {
    studentId, batchId, courseId,
  });

  await createNotification({
    userId: studentId,
    title: "Milestone Access Revoked",
    body: "An administrator has restricted access to one of your milestones. Contact support for details.",
    type: "GENERAL",
    referenceId: milestoneId,
  });
}

export async function adminResetMilestone(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  adminId: string
): Promise<void> {
  await MilestoneProgressModel.deleteOne({ studentId, batchId, courseId, milestoneId }).exec();
  await createAuditLog("MILESTONE_RESET", adminId, "MilestoneProgress", milestoneId, {
    studentId, batchId, courseId,
  });
}

export async function extendPaymentDueDate(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  newDueDays: number,
  adminId: string
): Promise<void> {
  const newDueAt = new Date(Date.now() + newDueDays * 24 * 60 * 60 * 1000);
  await MilestoneProgressModel.updateOne(
    { studentId, batchId, courseId, milestoneId },
    { $set: { paymentDueAt: newDueAt, paymentStatus: MILESTONE_PAYMENT_STATUS.ACTIVE } }
  ).exec();
  await createAuditLog("MILESTONE_PAYMENT_DUE_EXTENDED", adminId, "MilestoneProgress", milestoneId, {
    studentId, newDueAt,
  });
}

// ─── Lazy evaluation: process scheduled unlocks ───────────────────────────────

/**
 * Check and auto-unlock milestones whose scheduledUnlockAt has passed.
 * Called lazily when a student loads their course page (no background job needed).
 */
export async function processScheduledUnlocks(
  studentId: string,
  batchId: string,
  courseId: string
): Promise<void> {
  const now = new Date();
  const pending = await MilestoneProgressModel.find({
    studentId, batchId, courseId,
    unlocked: false,
    scheduledUnlockAt: { $lte: now },
  }).lean().exec();

  for (const p of pending) {
    const pDoc = p as { milestoneId: string; milestoneTitle: string; milestoneOrder: number };
    const fakeMilestone: MilestoneLike = {
      milestoneId: pDoc.milestoneId,
      title: pDoc.milestoneTitle,
      description: "",
      order: pDoc.milestoneOrder,
      feeInPaise: 0,
      unlockType: MILESTONE_UNLOCK_TYPE.RELATIVE_DATE,
      completionRule: MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS,
      certificateEligible: false,
      active: true,
      chapterOrders: [],
    };
    await unlockMilestone({
      studentId, batchId, courseId,
      milestoneId: pDoc.milestoneId,
      milestone: fakeMilestone,
      source: MILESTONE_UNLOCK_SOURCE.DATE_AUTO,
      actorId: "system",
    });
  }
}

// ─── Overdue detection ────────────────────────────────────────────────────────

export async function flagOverdueMilestones(): Promise<number> {
  const now = new Date();

  // Find milestones past due that are still locked and have ACTIVE payment status
  const candidates = await MilestoneProgressModel.find({
    paymentDueAt: { $lt: now },
    unlocked: false,
    paymentStatus: MILESTONE_PAYMENT_STATUS.ACTIVE,
  }).select("studentId batchId courseId milestoneId").lean().exec();

  if (candidates.length === 0) return 0;

  // Exclude milestones that already have a VERIFIED or PENDING payment (race: student paid but unlock hasn't fired yet)
  const toFlag: string[] = [];
  for (const c of candidates) {
    const cd = c as { _id: unknown; studentId: string; batchId: string; courseId: string; milestoneId: string };
    const hasPaidOrPending = await PaymentSubmissionModel.exists({
      studentId: cd.studentId,
      batchId: cd.batchId,
      courseId: cd.courseId,
      milestoneId: cd.milestoneId,
      status: { $in: ["PENDING", "VERIFIED"] },
    }).exec();
    if (!hasPaidOrPending) {
      toFlag.push(String(cd._id));
    }
  }

  if (toFlag.length === 0) return 0;

  const result = await MilestoneProgressModel.updateMany(
    { _id: { $in: toFlag }, paymentStatus: MILESTONE_PAYMENT_STATUS.ACTIVE },
    { $set: { paymentStatus: MILESTONE_PAYMENT_STATUS.OVERDUE } }
  ).exec();
  return result.modifiedCount;
}

// ─── Student milestone status (LMS view) ─────────────────────────────────────

export async function getStudentMilestoneStatus(
  studentId: string,
  batchId: string,
  courseId: string,
  courseSnapshot: unknown
) {
  if (!isLearningPlanActive(courseSnapshot)) return null;

  const milestones = getMilestonesFromSnapshot(courseSnapshot);
  const ordered = orderedActiveMilestones(milestones);

  const progressDocs = await MilestoneProgressModel.find({
    studentId, batchId, courseId,
  }).lean().exec();

  const progressMap = new Map(
    progressDocs.map((p) => [(p as { milestoneId: string }).milestoneId, p])
  );

  const enrollment = await EnrollmentModel.findOne({ studentId, batchId })
    .select("currentMilestoneId nextEligibleMilestoneId")
    .lean()
    .exec();

  // Calculate total program fee for display
  const totalProgramFeePaise = ordered.reduce((sum, m) => sum + (m.feeInPaise ?? 0), 0);

  return {
    autoLockPreviousMilestones: !!(courseSnapshot as { learningPlan?: { autoLockPreviousMilestones?: boolean } })?.learningPlan?.autoLockPreviousMilestones,
    currentMilestoneId: (enrollment as { currentMilestoneId?: string } | null)?.currentMilestoneId,
    nextEligibleMilestoneId: (enrollment as { nextEligibleMilestoneId?: string } | null)?.nextEligibleMilestoneId,
    totalProgramFeePaise,
    totalProgramFeeRupees: totalProgramFeePaise / 100,
    milestones: ordered.map((m) => {
      const p = progressMap.get(m.milestoneId) as Record<string, unknown> | undefined;
      return {
        milestoneId: m.milestoneId,
        title: m.title,
        description: m.description,
        order: m.order,
        feeInPaise: m.feeInPaise,
        feeRupees: m.feeInPaise / 100,
        unlockType: m.unlockType,
        completionRule: m.completionRule,
        certificateEligible: m.certificateEligible,
        chapterCount: m.chapterOrders.length,
        unlocked:      !!(p?.unlocked),
        locked:        !!(p?.locked),
        completed:     !!(p?.completed),
        completionPct: Number(p?.completionPct ?? 0),
        completedChapters: Number(p?.completedChapters ?? 0),
        totalChapters: Number(p?.totalChapters ?? m.chapterOrders.length),
        eligibleForNext: !!(p?.eligibleForNext),
        paymentStatus: String(p?.paymentStatus ?? MILESTONE_PAYMENT_STATUS.ACTIVE),
        paymentDueAt: p?.paymentDueAt as Date | undefined,
        unlockedAt:  p?.unlockedAt as Date | undefined,
        completedAt: p?.completedAt as Date | undefined,
        milestoneCertificateId: p?.milestoneCertificateId as string | undefined,
        scheduledUnlockAt: p?.scheduledUnlockAt as Date | undefined,
      };
    }),
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getLearningPlanAnalytics(courseId: string, batchId?: string) {
  const filter: Record<string, unknown> = { courseId };
  if (batchId) {
    // Resolve human-readable batchId to Mongo ObjectId for consistent filtering
    const batch = await findBatchByParam(batchId);
    if (batch) {
      filter.batchId = String((batch as { _id: unknown })._id);
    } else {
      filter.batchId = batchId; // fallback — use as-is
    }
  }

  const allProgress = await MilestoneProgressModel.find(filter).lean().exec();

  const byMilestone = new Map<string, {
    milestoneTitle: string;
    studentsUnlocked: number;
    studentsCompleted: number;
    studentsEligibleNotPaid: number;
    studentsOverdue: number;
    licenseKeyUnlocks: number;
    manualUnlocks: number;
    completionTotalDays: number;
    completionCount: number;
  }>();

  for (const p of allProgress) {
    const pd = p as {
      milestoneId: string; milestoneTitle: string;
      unlocked?: boolean; completed?: boolean; eligibleForNext?: boolean;
      paymentStatus?: string; unlockSource?: string;
      unlockedAt?: Date; completedAt?: Date;
    };
    if (!byMilestone.has(pd.milestoneId)) {
      byMilestone.set(pd.milestoneId, {
        milestoneTitle: pd.milestoneTitle,
        studentsUnlocked: 0, studentsCompleted: 0,
        studentsEligibleNotPaid: 0, studentsOverdue: 0,
        licenseKeyUnlocks: 0, manualUnlocks: 0,
        completionTotalDays: 0, completionCount: 0,
      });
    }
    const bucket = byMilestone.get(pd.milestoneId)!;
    if (pd.unlocked) bucket.studentsUnlocked++;
    if (pd.completed) {
      bucket.studentsCompleted++;
      if (pd.unlockedAt && pd.completedAt) {
        const days = (pd.completedAt.getTime() - pd.unlockedAt.getTime()) / 86400000;
        bucket.completionTotalDays += days;
        bucket.completionCount++;
      }
    }
    if (pd.eligibleForNext && !pd.unlocked) bucket.studentsEligibleNotPaid++;
    if (pd.paymentStatus === MILESTONE_PAYMENT_STATUS.OVERDUE) bucket.studentsOverdue++;
    if (pd.unlockSource === MILESTONE_UNLOCK_SOURCE.LICENSE_KEY) bucket.licenseKeyUnlocks++;
    if (pd.unlockSource === MILESTONE_UNLOCK_SOURCE.MANUAL) bucket.manualUnlocks++;
  }

  // ── Revenue Per Milestone ────────────────────────────────────────────────────
  const milestoneIds = Array.from(byMilestone.keys());
  const revenueAgg = milestoneIds.length > 0
    ? await PaymentSubmissionModel.aggregate<{ _id: string; revenuePaise: number; paymentCount: number }>([
        { $match: { milestoneId: { $in: milestoneIds }, status: "VERIFIED", ...filter } },
        { $group: { _id: "$milestoneId", revenuePaise: { $sum: { $ifNull: ["$amountPaise", 0] } }, paymentCount: { $sum: 1 } } },
      ])
    : [];
  const revenueByMilestone = new Map(revenueAgg.map((r) => [r._id, r]));

  // ── Conversion Rate Between Milestones ──────────────────────────────────────
  const sortedMilestoneEntries = Array.from(byMilestone.entries())
    .sort((a, b) => {
      const orderA = allProgress.find((p) => (p as { milestoneId: string }).milestoneId === a[0]) as { milestoneOrder?: number } | undefined;
      const orderB = allProgress.find((p) => (p as { milestoneId: string }).milestoneId === b[0]) as { milestoneOrder?: number } | undefined;
      return (orderA?.milestoneOrder ?? 0) - (orderB?.milestoneOrder ?? 0);
    });

  return sortedMilestoneEntries.map(([milestoneId, data], idx) => {
    const revenue = revenueByMilestone.get(milestoneId);
    let conversionFromPrevious: number | null = null;
    if (idx > 0) {
      const prevData = sortedMilestoneEntries[idx - 1][1];
      if (prevData.studentsCompleted > 0) {
        conversionFromPrevious = Math.round((data.studentsUnlocked / prevData.studentsCompleted) * 100);
      }
    }
    return {
      milestoneId,
      ...data,
      revenuePaise: revenue?.revenuePaise ?? 0,
      revenueRupees: Number(((revenue?.revenuePaise ?? 0) / 100).toFixed(2)),
      paymentCount: revenue?.paymentCount ?? 0,
      avgCompletionDays: data.completionCount > 0
        ? Math.round(data.completionTotalDays / data.completionCount * 10) / 10
        : 0,
      completionRate: data.studentsUnlocked > 0
        ? Math.round((data.studentsCompleted / data.studentsUnlocked) * 100)
        : 0,
      conversionFromPrevious,
    };
  });
}

// ─── Admin: Skip Milestone ────────────────────────────────────────────────────

/**
 * Atomically marks the given milestone as completed and unlocks the next one.
 * Used when admin promotes a student past a milestone.
 */
export async function adminSkipMilestone(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string,
  adminId: string
): Promise<void> {
  const batch = await findBatchByParam(batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) throw new AppError("Course not found in batch", 404);

  const milestones = getMilestonesFromSnapshot(snap);
  const ordered = orderedActiveMilestones(milestones);
  const milestone = ordered.find((m) => m.milestoneId === milestoneId);
  if (!milestone) throw new AppError("Milestone not found", 404);

  // First: ensure milestone is unlocked
  const existing = await MilestoneProgressModel.findOne({ studentId, batchId, courseId, milestoneId }).exec();
  if (!existing || !(existing as { unlocked?: boolean }).unlocked) {
    // Unlock it first via manual
    await unlockMilestone({
      studentId, batchId, courseId, milestoneId,
      milestone,
      source: MILESTONE_UNLOCK_SOURCE.MANUAL,
      actorId: adminId,
    });
  }

  // Mark as completed
  const now = new Date();
  await MilestoneProgressModel.updateOne(
    { studentId, batchId, courseId, milestoneId },
    {
      $set: {
        completed: true,
        completedAt: now,
        completionPct: 100,
        completedChapters: Array.isArray(milestone.chapterOrders) ? milestone.chapterOrders.length : 0,
        eligibleForNext: true,
        eligibleAt: now,
      },
    }
  ).exec();

  // Trigger the completion flow (cert, next unlock, enrollment update, notification)
  await onMilestoneCompleted(studentId, batchId, courseId, milestoneId, milestone);

  await createAuditLog("MILESTONE_COMPLETED", adminId, "MilestoneProgress", milestoneId, {
    studentId, batchId, courseId, milestoneTitle: milestone.title, skippedByAdmin: true,
  });
}

// ─── Export helpers for use in other services ─────────────────────────────────

export { isLearningPlanActive, getMilestonesFromSnapshot, findMilestoneForChapter, orderedActiveMilestones };

// ─── Milestone Quiz recalculation hook ────────────────────────────────────────

/**
 * Called by quiz.service after a milestone quiz is passed.
 * Triggers a re-evaluation of milestone completion.
 */
export async function recalculateMilestoneProgressAfterQuiz(
  studentId: string,
  batchId: string,
  courseId: string,
  milestoneId: string
): Promise<void> {
  const batch = await findBatchByParam(batchId);
  if (!batch) return;
  const snaps = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snap = snaps.find((s) => (s as { courseId?: string }).courseId === courseId) ?? snaps[0];
  if (!snap) return;
  const milestones = getMilestonesFromSnapshot(snap);
  const milestone = milestones.find((m) => m.milestoneId === milestoneId);
  if (!milestone) return;
  await recalculateMilestoneProgress(studentId, batchId, courseId, milestoneId, milestone);
}
