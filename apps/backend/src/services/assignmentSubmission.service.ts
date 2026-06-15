
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { UserModel } from "../models/User.model.js";
import { findBatchByParam, getBatchCourseSnapshots, getModuleAssignmentOverrides } from "./batch.service.js";
import { findAssignmentByParam } from "./globalAssignment.service.js";
import { SUBMISSION_TYPE, SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";
import { createAuditLog } from "./audit.service.js";
import { awardStudentXp } from "./studentCourse.service.js";
import { requireActiveEnrollment } from "./enrollment.service.js";
import { ensureFirstAssignmentBadge } from "./achievement.service.js";
import { generateSubmissionId } from "../utils/funtIdGenerator.js";
import { AppError } from "../utils/AppError.js";
import {
  isLearningPlanActive,
  getMilestonesFromSnapshot,
  findMilestoneForChapter,
  recalculateMilestoneProgress,
} from "./learningPlan.service.js";

export interface SubmitAssignmentInput {
  studentId: string;
  batchId: string;
  chapterOrder: number;
  assignmentId: string;
  submissionType: string;
  submissionContent: string;
  courseId?: string;
}

export async function submitAssignment(input: SubmitAssignmentInput) {
  const batch = await findBatchByParam(input.batchId);
  if (!batch) throw new AppError("Batch not found", 404);
  const batchMongoId = String((batch as { _id: unknown })._id);
  await requireActiveEnrollment(input.studentId, input.batchId);

  const snapshots = getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]);
  const snapshot = input.courseId
    ? snapshots.find((s) => (s as { courseId?: string }).courseId === input.courseId)
    : snapshots[0];
  if (!snapshot) throw new AppError("Course not found in batch", 404);
  const snapshotCourseId = (snapshot as { courseId?: string }).courseId ?? String((batch as { _id: unknown })._id);
  const chapters = (snapshot as { modules?: unknown[] }).modules ?? [];
  const chapterAt = chapters[input.chapterOrder];
  if (!chapterAt) throw new AppError("Chapter not found in batch", 404);

  const assignmentDoc = await findAssignmentByParam(input.assignmentId);
  if (!assignmentDoc) throw new AppError("Assignment not found", 404);
  const assignmentMongoId = String((assignmentDoc as { _id: unknown })._id);
  const assignment = assignmentDoc.toObject ? assignmentDoc.toObject() : assignmentDoc;

  const overrides = await getModuleAssignmentOverrides(input.batchId, input.courseId, input.chapterOrder);
  const effectiveSubmissionType = overrides?.submissionType?.trim() || (assignment as { submissionType: string }).submissionType;

  const validTypes = Object.values(SUBMISSION_TYPE);
  if (!validTypes.includes(input.submissionType as (typeof validTypes)[number])) {
    throw new AppError(`submissionType must be one of: ${validTypes.join(", ")}`, 400);
  }
  if (effectiveSubmissionType !== input.submissionType) {
    throw new AppError("Submission type does not match assignment type", 400);
  }

  const existing = await AssignmentSubmissionModel.findOne({
    studentId: input.studentId,
    batchId: batchMongoId,
    moduleOrder: input.chapterOrder,
    $or: [{ courseId: snapshotCourseId }, { courseId: null }, { courseId: { $exists: false } }],
  }).exec();
  if (existing) throw new AppError("You can only submit once for this chapter assignment.", 400);

  const submissionId = await generateSubmissionId();
  const doc = await AssignmentSubmissionModel.create({
    submissionId,
    studentId: input.studentId,
    batchId: batchMongoId,
    courseId: snapshotCourseId,
    moduleOrder: input.chapterOrder,
    assignmentId: assignmentMongoId,
    submissionType: input.submissionType,
    submissionContent: input.submissionContent,
    status: SUBMISSION_REVIEW_STATUS.PENDING,
  });

  await createAuditLog("ASSIGNMENT_SUBMITTED", input.studentId, "AssignmentSubmission", String(doc._id));

  return {
    id: String(doc._id),
    submissionId: doc.submissionId,
    studentId: doc.studentId,
    batchId: doc.batchId,
    courseId: doc.courseId ?? undefined,
    chapterOrder: doc.moduleOrder,
    moduleOrder: doc.moduleOrder,
    assignmentId: doc.assignmentId,
    submissionType: doc.submissionType,
    status: doc.status,
    submittedAt: doc.submittedAt,
  };
}

export interface ReviewSubmissionInput {
  submissionId: string;
  status: "APPROVED" | "REJECTED";
  feedback?: string;
  rating?: number;
  reviewedBy: string;
  isTrainer: boolean;
  trainerBatchId?: string;
}

export async function reviewSubmission(input: ReviewSubmissionInput) {
  const sub = await AssignmentSubmissionModel.findById(input.submissionId).exec();
  if (!sub) throw new AppError("Submission not found", 404);

  if (sub.status !== SUBMISSION_REVIEW_STATUS.PENDING) {
    throw new AppError("Submission has already been reviewed", 400);
  }

  if (input.isTrainer && input.trainerBatchId) {
    const trainerBatch = await findBatchByParam(input.trainerBatchId);
    const trainerBatchMongoId = trainerBatch ? String((trainerBatch as { _id: unknown })._id) : null;
    if (trainerBatchMongoId !== sub.batchId) {
      throw new AppError("You can only review submissions for batches assigned to you", 403);
    }
  }

  sub.status =
    input.status === "APPROVED"
      ? SUBMISSION_REVIEW_STATUS.APPROVED
      : SUBMISSION_REVIEW_STATUS.REJECTED;
  sub.feedback = input.feedback;
  sub.rating = input.rating;
  sub.reviewedAt = new Date();
  sub.reviewedBy = input.reviewedBy;
  await sub.save();

  if (input.status === "APPROVED") {
    await createAuditLog("ASSIGNMENT_APPROVED", input.reviewedBy, "AssignmentSubmission", String(sub._id));
    await awardStudentXp(sub.studentId, 50).catch(() => {});
    await ensureFirstAssignmentBadge(sub.studentId).catch(() => {});
    const now = new Date();
    const subCourseId = (sub as { courseId?: string }).courseId;
    const progressQuery =
      subCourseId != null
        ? { studentId: sub.studentId, batchId: sub.batchId, courseId: subCourseId, moduleOrder: sub.moduleOrder }
        : { studentId: sub.studentId, batchId: sub.batchId, moduleOrder: sub.moduleOrder, $or: [{ courseId: null }, { courseId: { $exists: false } }] };
    const updated = await ChapterProgressModel.findOneAndUpdate(
      progressQuery,
      {
        $set: {
          studentId: sub.studentId,
          batchId: sub.batchId,
          ...(subCourseId != null && { courseId: subCourseId }),
          moduleOrder: sub.moduleOrder,
          assignmentCompletedAt: now,
          completedBy: input.reviewedBy,
          isManualOverride: false,
        },
      },
      { upsert: true, new: true }
    ).lean().exec();
    const batch = await BatchModel.findById(sub.batchId).lean().exec();
    const snapshots = batch ? getBatchCourseSnapshots(batch as Parameters<typeof getBatchCourseSnapshots>[0]) : [];
    const snapshot = subCourseId ? snapshots.find((s) => (s as { courseId?: string }).courseId === subCourseId) : snapshots[0];
    const rawChapters = (snapshot as { modules?: Array<{ content?: string; videoUrl?: string; youtubeUrl?: string; resourceLinkUrl?: string; linkedAssignmentId?: string }> })?.modules ?? [];
    const chapter = rawChapters[sub.moduleOrder];
    const hasContent = !!chapter?.content?.trim?.();
    const hasVideo = !!chapter?.videoUrl?.trim?.();
    const hasYoutube = !!chapter?.youtubeUrl?.trim?.();
    const hasAssignment = !!chapter?.linkedAssignmentId?.trim?.();
    const p = updated as { contentCompletedAt?: Date; videoCompletedAt?: Date; youtubeCompletedAt?: Date; assignmentCompletedAt?: Date };
    const allDone =
      (!hasContent || !!p.contentCompletedAt) &&
      (!hasVideo || !!p.videoCompletedAt) &&
      (!hasYoutube || !!p.youtubeCompletedAt) &&
      (!hasAssignment || !!p.assignmentCompletedAt);
    if (allDone) {
      await ChapterProgressModel.updateOne(progressQuery, { $set: { completedAt: now } }).exec();
    }

    // ── Learning Plan: recalculate milestone progress after assignment approval ──
    if (snapshot && isLearningPlanActive(snapshot)) {
      const milestones = getMilestonesFromSnapshot(snapshot);
      const milestone = findMilestoneForChapter(milestones, sub.moduleOrder);
      if (milestone) {
        const snapshotCourseId = subCourseId ?? sub.batchId;
        try {
          await recalculateMilestoneProgress(
            sub.studentId, sub.batchId, snapshotCourseId,
            milestone.milestoneId, milestone
          );
        } catch (lpErr) {
          console.error(
            `[LP_RECALC_FAILED] assignment approval: studentId=${sub.studentId} milestoneId=${milestone.milestoneId}`,
            lpErr instanceof Error ? lpErr.message : lpErr
          );
        }
      }
    }
  } else {
    await createAuditLog("ASSIGNMENT_REJECTED", input.reviewedBy, "AssignmentSubmission", String(sub._id));
  }

  return {
    id: String(sub._id),
    submissionId: (sub as { submissionId?: string }).submissionId,
    studentId: sub.studentId,
    batchId: sub.batchId,
    chapterOrder: sub.moduleOrder,
    moduleOrder: sub.moduleOrder,
    status: sub.status,
    feedback: sub.feedback,
    rating: sub.rating,
    reviewedAt: sub.reviewedAt,
    reviewedBy: sub.reviewedBy,
  };
}

export interface BulkReviewSubmissionsInput {
  submissionIds: string[];
  status: "APPROVED" | "REJECTED";
  feedback?: string;
  rating?: number;
  reviewedBy: string;
  isTrainer: boolean;
}

export async function bulkReviewSubmissions(input: BulkReviewSubmissionsInput) {
  const ids = Array.isArray(input.submissionIds) ? input.submissionIds.filter((id) => id && String(id).trim()) : [];
  const result = { reviewed: 0, skipped: 0, errors: [] as string[] };
  for (const submissionId of ids) {
    try {
      const sub = await AssignmentSubmissionModel.findById(submissionId).lean().exec();
      if (!sub) {
        result.errors.push(`${submissionId}: not found`);
        continue;
      }
      if (sub.status !== SUBMISSION_REVIEW_STATUS.PENDING) {
        result.skipped += 1;
        continue;
      }
      const batchId = sub.batchId;
      if (input.isTrainer) {
        const batch = await BatchModel.findById(batchId).lean().exec();
        if (!batch || (batch as { trainerId?: string }).trainerId !== input.reviewedBy) {
          result.errors.push(`${submissionId}: not assigned to you`);
          continue;
        }
      }
      await reviewSubmission({
        submissionId,
        status: input.status,
        feedback: input.feedback,
        rating: input.rating,
        reviewedBy: input.reviewedBy,
        isTrainer: input.isTrainer,
        trainerBatchId: input.isTrainer ? batchId : undefined,
      });
      result.reviewed += 1;
    } catch (err) {
      result.errors.push(`${submissionId}: ${err instanceof Error ? err.message : "Failed"}`);
    }
  }
  return result;
}

async function getStudentUsernameMap(studentIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: unique } }).select("_id username").lean().exec();
  const map = new Map<string, string>();
  for (const u of users) {
    const id = String(u._id);
    const username = (u as { username?: string }).username;
    if (username) map.set(id, username);
  }
  return map;
}

export async function listSubmissionsForBatch(
  batchId: string,
  options: { trainerId?: string; studentId?: string; chapterOrder?: number; courseId?: string }
) {
  const batch = await findBatchByParam(batchId);
  if (!batch) return [];
  const batchMongoId = String((batch as { _id: unknown })._id);
  const query: Record<string, unknown> = { batchId: batchMongoId };
  if (options.studentId) query.studentId = options.studentId;
  if (options.chapterOrder !== undefined && options.chapterOrder !== null) query.moduleOrder = options.chapterOrder;
  if (options.courseId !== undefined && options.courseId !== null && options.courseId !== "") {
    query.$or = [{ courseId: options.courseId }, { courseId: null }, { courseId: { $exists: false } }];
  }
  const list = await AssignmentSubmissionModel.find(query).sort({ submittedAt: -1 }).lean().exec();
  const usernameMap = await getStudentUsernameMap(list.map((d) => d.studentId));
  return list.map((d) => ({
    id: String(d._id),
    submissionId: (d as { submissionId?: string }).submissionId,
    studentId: usernameMap.get(d.studentId) ?? d.studentId,
    batchId: d.batchId,
    courseId: (d as { courseId?: string }).courseId ?? undefined,
    chapterOrder: d.moduleOrder,
    moduleOrder: d.moduleOrder,
    assignmentId: d.assignmentId,
    submissionType: d.submissionType,
    submissionContent: d.submissionContent,
    status: d.status,
    feedback: d.feedback,
    rating: d.rating,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
    reviewedBy: d.reviewedBy,
  }));
}

/** List all submissions by a student (for "my submissions" with feedback). */
export async function listChapterSubmissionsByStudentId(studentId: string) {
  const list = await AssignmentSubmissionModel.find({ studentId }).sort({ submittedAt: -1 }).lean().exec();
  if (list.length === 0) return [];
  const assignmentIds = [...new Set(list.map((d) => d.assignmentId))];
  const batchIds = [...new Set(list.map((d) => d.batchId))];
  const [assignments, batches] = await Promise.all([
    GlobalAssignmentModel.find({ _id: { $in: assignmentIds } }).select("_id title").lean().exec(),
    BatchModel.find({ _id: { $in: batchIds } }).select("_id name").lean().exec(),
  ]);
  const assignmentMap = new Map(assignments.map((a) => [String(a._id), (a as { title: string }).title]));
  const batchMap = new Map(batches.map((b) => [String(b._id), (b as { name: string }).name]));
  return list.map((d) => ({
    id: String(d._id),
    submissionId: (d as { submissionId?: string }).submissionId,
    type: "chapter" as const,
    assignmentId: d.assignmentId,
    assignmentTitle: assignmentMap.get(d.assignmentId) ?? "Assignment",
    batchId: d.batchId,
    batchName: batchMap.get(d.batchId) ?? d.batchId,
    courseId: (d as { courseId?: string }).courseId ?? undefined,
    chapterOrder: d.moduleOrder,
    moduleOrder: d.moduleOrder,
    status: d.status,
    feedback: d.feedback,
    rating: d.rating,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
  }));
}

export async function listSubmissionsByAssignmentId(assignmentId: string) {
  const assignment = await findAssignmentByParam(assignmentId);
  if (!assignment) return [];
  const assignmentMongoId = String((assignment as { _id: unknown })._id);
  const list = await AssignmentSubmissionModel.find({ assignmentId: assignmentMongoId })
    .sort({ submittedAt: -1 })
    .lean()
    .exec();
  const batchIds = [...new Set(list.map((d) => d.batchId))];
  const [batches, usernameMap] = await Promise.all([
    BatchModel.find({ _id: { $in: batchIds } }).select("_id name").lean().exec(),
    getStudentUsernameMap(list.map((d) => d.studentId)),
  ]);
  const batchMap = new Map(batches.map((b) => [String(b._id), (b as { name: string }).name]));
  return list.map((d) => ({
    id: String(d._id),
    submissionId: (d as { submissionId?: string }).submissionId,
    type: "chapter" as const,
    studentId: usernameMap.get(d.studentId) ?? d.studentId,
    batchId: d.batchId,
    batchName: batchMap.get(d.batchId) ?? d.batchId,
    chapterOrder: d.moduleOrder,
    moduleOrder: d.moduleOrder,
    assignmentId: d.assignmentId,
    submissionType: d.submissionType,
    submissionContent: d.submissionContent,
    status: d.status,
    feedback: d.feedback,
    rating: d.rating,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
    reviewedBy: d.reviewedBy,
  }));
}
