/**
 * Assignment submission controller – submit (student), review (admin/trainer), list.
 */

import type { Request, Response } from "express";
import * as service from "../services/assignmentSubmission.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const submitAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId, moduleOrder, assignmentId, submissionType, submissionContent, courseId } = req.body ?? {};
  if (!batchId || moduleOrder === undefined || !assignmentId || !submissionType || submissionContent == null) {
    throw new AppError("batchId, moduleOrder, assignmentId, submissionType, submissionContent are required", 400);
  }
  const data = await service.submitAssignment({
    studentId,
    batchId,
    moduleOrder: Number(moduleOrder),
    assignmentId,
    submissionType,
    submissionContent: String(submissionContent),
    courseId: courseId ? String(courseId) : undefined,
  });
  successRes(res, data, "Submission created", 201);
});

export const reviewSubmission = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const reviewedBy = getUserId(req);
  const id = req.params.id;
  if (!id) throw new AppError("Submission ID is required", 400);
  const { status, feedback, rating } = req.body ?? {};
  if (!status || (status !== "APPROVED" && status !== "REJECTED")) {
    throw new AppError("status must be APPROVED or REJECTED", 400);
  }
  const isTrainer = Boolean(req.user?.roles?.includes(ROLE.TRAINER));
  const { AssignmentSubmissionModel } = await import("../models/AssignmentSubmission.model.js");
  const submissionDoc = await AssignmentSubmissionModel.findById(id).lean().exec();
  if (!submissionDoc) throw new AppError("Submission not found", 404);
  const batchId = submissionDoc.batchId;
  if (isTrainer) {
    const { findBatchByParam } = await import("../services/batch.service.js");
    const batch = await findBatchByParam(batchId);
    if (!batch || (batch as { trainerId?: string }).trainerId !== reviewedBy) {
      throw new AppError("You can only review submissions for batches assigned to you", 403);
    }
  }
  const data = await service.reviewSubmission({
    submissionId: id,
    status,
    feedback,
    rating: rating != null ? Number(rating) : undefined,
    reviewedBy,
    isTrainer,
    trainerBatchId: isTrainer ? batchId : undefined,
  });
  successRes(res, data, "Submission reviewed");
});

export const bulkReviewSubmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const reviewedBy = getUserId(req);
  const { submissionIds, status, feedback, rating } = req.body ?? {};
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    throw new AppError("submissionIds must be a non-empty array", 400);
  }
  if (status !== "APPROVED" && status !== "REJECTED") {
    throw new AppError("status must be APPROVED or REJECTED", 400);
  }
  const isTrainer = Boolean(req.user?.roles?.includes(ROLE.TRAINER));
  const data = await service.bulkReviewSubmissions({
    submissionIds,
    status,
    feedback: typeof feedback === "string" ? feedback : undefined,
    rating: rating != null ? Number(rating) : undefined,
    reviewedBy,
    isTrainer,
  });
  successRes(res, data, "Bulk review completed");
});

export const listSubmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const batchId = req.query.batchId as string;
  const studentId = req.query.studentId as string | undefined;
  const moduleOrderParam = req.query.moduleOrder as string | undefined;
  const courseId = req.query.courseId as string | undefined;
  if (!batchId) throw new AppError("batchId query is required", 400);
  const moduleOrder = moduleOrderParam != null && moduleOrderParam !== "" ? parseInt(moduleOrderParam, 10) : undefined;
  const isTrainer = Boolean(req.user?.roles?.includes(ROLE.TRAINER));
  const userId = getUserId(req);
  if (isTrainer) {
    const { findBatchByParam } = await import("../services/batch.service.js");
    const batch = await findBatchByParam(batchId);
    if (!batch || (batch as { trainerId?: string }).trainerId !== userId) {
      throw new AppError("You can only list submissions for batches assigned to you", 403);
    }
  }
  const data = await service.listSubmissionsForBatch(batchId, {
    studentId,
    ...(Number.isInteger(moduleOrder) && !Number.isNaN(moduleOrder as number) && { moduleOrder: moduleOrder as number }),
    ...(courseId != null && courseId !== "" && { courseId }),
  });
  successRes(res, data);
});
