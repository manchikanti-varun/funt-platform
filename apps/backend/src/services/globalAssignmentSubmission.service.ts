
import { GlobalAssignmentSubmissionModel } from "../models/GlobalAssignmentSubmission.model.js";
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { UserModel } from "../models/User.model.js";
import { findAssignmentByParam } from "./globalAssignment.service.js";
import { ASSIGNMENT_STATUS, SUBMISSION_TYPE } from "@funt-platform/constants";
import { AppError } from "../utils/AppError.js";

const VALID_SUBMISSION_TYPES = Object.values(SUBMISSION_TYPE);

export interface SubmitGlobalAssignmentInput {
  studentId: string;
  assignmentId: string;
  trainerId?: string;
  submissionType: string;
  submissionContent: string;
}

export async function submitGlobalAssignment(input: SubmitGlobalAssignmentInput) {
  if (!input.submissionType || !VALID_SUBMISSION_TYPES.includes(input.submissionType as (typeof VALID_SUBMISSION_TYPES)[number])) {
    throw new AppError(`submissionType must be one of: ${VALID_SUBMISSION_TYPES.join(", ")}`, 400);
  }
  if (input.submissionContent == null || String(input.submissionContent).trim() === "") {
    throw new AppError("submissionContent is required", 400);
  }

  const assignmentDoc = await findAssignmentByParam(input.assignmentId);
  if (!assignmentDoc) throw new AppError("Assignment not found", 404);
  const assignmentMongoId = String((assignmentDoc as { _id: unknown })._id);
  const assignment = assignmentDoc.toObject ? assignmentDoc.toObject() : assignmentDoc;
  const status = assignment.status;
  const isArchived = status === ASSIGNMENT_STATUS.ARCHIVED;
  if (isArchived) {
    throw new AppError("This assignment is not open for submissions", 400);
  }
  if (assignment.submissionType !== input.submissionType) {
    throw new AppError(`Submission type must be ${assignment.submissionType} for this assignment`, 400);
  }

  const existing = await GlobalAssignmentSubmissionModel.findOne({
    studentId: input.studentId,
    assignmentId: assignmentMongoId,
  }).exec();
  if (existing) throw new AppError("You can only submit once for this assignment.", 400);

  const trainerId = input.trainerId && String(input.trainerId).trim() ? String(input.trainerId).trim() : "";

  const doc = await GlobalAssignmentSubmissionModel.create({
    studentId: input.studentId,
    assignmentId: assignmentMongoId,
    trainerId,
    submissionType: input.submissionType,
    submissionContent: String(input.submissionContent).trim(),
  });

  return {
    id: String(doc._id),
    assignmentId: doc.assignmentId,
    trainerId: doc.trainerId,
    submissionType: doc.submissionType,
    submittedAt: doc.submittedAt,
  };
}

export interface ListGlobalSubmissionsFilters {
  assignmentId?: string;
  trainerId?: string;
  status?: string;
}

async function getStudentFuntIdMap(studentIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: unique } }).select("_id funtId").lean().exec();
  const map = new Map<string, string>();
  for (const u of users) {
    const id = String(u._id);
    const funtId = (u as { funtId?: string }).funtId;
    if (funtId) map.set(id, funtId);
  }
  return map;
}

export async function listGlobalSubmissions(filters?: ListGlobalSubmissionsFilters) {
  const query: Record<string, unknown> = {};
  if (filters?.assignmentId) query.assignmentId = filters.assignmentId;
  if (filters?.trainerId) query.trainerId = filters.trainerId;
  if (filters?.status) query.status = filters.status;

  const list = await GlobalAssignmentSubmissionModel.find(query)
    .sort({ submittedAt: -1 })
    .lean()
    .exec();

  const funtIdMap = await getStudentFuntIdMap(list.map((d) => d.studentId));

  return list.map((d) => ({
    id: String(d._id),
    studentId: funtIdMap.get(d.studentId) ?? d.studentId,
    assignmentId: d.assignmentId,
    trainerId: d.trainerId,
    submissionType: d.submissionType,
    submissionContent: d.submissionContent,
    status: d.status,
    feedback: d.feedback,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
    reviewedBy: d.reviewedBy,
  }));
}

export async function listGeneralSubmissionsByStudentId(studentId: string) {
  const list = await GlobalAssignmentSubmissionModel.find({ studentId })
    .sort({ submittedAt: -1 })
    .lean()
    .exec();
  if (list.length === 0) return [];
  const assignmentIds = [...new Set(list.map((d) => d.assignmentId))];
  const assignments = await GlobalAssignmentModel.find({ _id: { $in: assignmentIds } })
    .select("_id title")
    .lean()
    .exec();
  const assignmentMap = new Map(assignments.map((a) => [String(a._id), (a as { title: string }).title]));
  return list.map((d) => ({
    id: String(d._id),
    type: "general" as const,
    assignmentId: d.assignmentId,
    assignmentTitle: assignmentMap.get(d.assignmentId) ?? "Assignment",
    status: d.status,
    feedback: d.feedback,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
  }));
}

export interface ReviewGlobalSubmissionInput {
  submissionId: string;
  status: "APPROVED" | "REJECTED";
  feedback?: string;
  reviewedBy: string;
}

export async function reviewGlobalSubmission(input: ReviewGlobalSubmissionInput & { trainerIdOnly?: string }) {
  const { SUBMISSION_REVIEW_STATUS } = await import("@funt-platform/constants");
  const sub = await GlobalAssignmentSubmissionModel.findById(input.submissionId).exec();
  if (!sub) throw new AppError("Submission not found", 404);
  if (sub.status !== SUBMISSION_REVIEW_STATUS.PENDING) {
    throw new AppError("Submission has already been reviewed", 400);
  }
  if (input.trainerIdOnly && sub.trainerId !== input.trainerIdOnly) {
    throw new AppError("You can only review submissions assigned to you", 403);
  }

  sub.status = input.status === "APPROVED" ? SUBMISSION_REVIEW_STATUS.APPROVED : SUBMISSION_REVIEW_STATUS.REJECTED;
  sub.feedback = input.feedback;
  sub.reviewedAt = new Date();
  sub.reviewedBy = input.reviewedBy;
  await sub.save();

  return {
    id: String(sub._id),
    status: sub.status,
    feedback: sub.feedback,
    reviewedAt: sub.reviewedAt,
    reviewedBy: sub.reviewedBy,
  };
}

export interface BulkReviewGlobalSubmissionsInput {
  submissionIds: string[];
  status: "APPROVED" | "REJECTED";
  feedback?: string;
  reviewedBy: string;
  trainerIdOnly?: string;
}

export async function bulkReviewGlobalSubmissions(input: BulkReviewGlobalSubmissionsInput) {
  const { SUBMISSION_REVIEW_STATUS } = await import("@funt-platform/constants");
  const ids = Array.isArray(input.submissionIds) ? input.submissionIds.filter((id) => id && String(id).trim()) : [];
  if (ids.length === 0) return { reviewed: 0, skipped: 0, errors: [] as string[] };

  const results = { reviewed: 0, skipped: 0, errors: [] as string[] };
  for (const submissionId of ids) {
    try {
      const sub = await GlobalAssignmentSubmissionModel.findById(submissionId).exec();
      if (!sub) {
        results.errors.push(`${submissionId}: not found`);
        continue;
      }
      if (sub.status !== SUBMISSION_REVIEW_STATUS.PENDING) {
        results.skipped += 1;
        continue;
      }
      if (input.trainerIdOnly && sub.trainerId !== input.trainerIdOnly) {
        results.errors.push(`${submissionId}: not assigned to you`);
        continue;
      }
      sub.status = input.status === "APPROVED" ? SUBMISSION_REVIEW_STATUS.APPROVED : SUBMISSION_REVIEW_STATUS.REJECTED;
      sub.feedback = input.feedback ?? sub.feedback;
      sub.reviewedAt = new Date();
      sub.reviewedBy = input.reviewedBy;
      await sub.save();
      results.reviewed += 1;
    } catch (err) {
      results.errors.push(`${submissionId}: ${err instanceof Error ? err.message : "Failed"}`);
    }
  }
  return results;
}
