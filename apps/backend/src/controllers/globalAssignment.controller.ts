/**
 * Global Assignment controller – CRUD + archive. Admin/Super Admin only.
 */

import type { Request, Response } from "express";
import * as service from "../services/globalAssignment.service.js";
import * as globalSubmissionService from "../services/globalAssignmentSubmission.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function isTrainer(req: Request): boolean {
  return Array.isArray(req.user?.roles) && req.user.roles.includes(ROLE.TRAINER);
}

export const createAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const body = req.body ?? {};
  const { title, instructions, submissionType, skillTags, allowedStudentIds, moderatorIds } = body;
  const rawType = body.type;
  const assignmentType =
    typeof rawType === "string" && String(rawType).toLowerCase() === "general" ? "general" : "module";
  const data = await service.createAssignment({
    title,
    instructions,
    submissionType,
    skillTags,
    type: assignmentType,
    allowedStudentIds: Array.isArray(allowedStudentIds) ? allowedStudentIds : undefined,
    moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : undefined,
    createdBy,
  });
  successRes(res, data, "Assignment created", 201);
});

export const listAssignments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = (req.query.search ?? req.query.q) as string | undefined;
  const data = await service.listAssignments({ ...(status && { status }), ...(search && { search }) });
  successRes(res, data);
});

export const getAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Assignment ID is required", 400);
  const data = await service.getAssignmentById(id);
  successRes(res, data);
});

export const updateAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Assignment ID is required", 400);
  const body = req.body ?? {};
  const { title, instructions, submissionType, skillTags, allowedStudentIds, moderatorIds } = body;
  const rawType = body.type;
  const assignmentType =
    typeof rawType === "string"
      ? String(rawType).toLowerCase() === "general"
        ? "general"
        : "module"
      : undefined;
  const data = await service.updateAssignment(
    id,
    {
      title,
      instructions,
      submissionType,
      skillTags,
      type: assignmentType,
      allowedStudentIds: Array.isArray(allowedStudentIds) ? allowedStudentIds : undefined,
      moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : undefined,
    },
    performedBy
  );
  successRes(res, data, "Assignment updated");
});

export const archiveAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Assignment ID is required", 400);
  const data = await service.archiveAssignment(id, performedBy);
  successRes(res, data, "Assignment archived");
});

export const duplicateAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Assignment ID is required", 400);
  const data = await service.duplicateAssignment(id, performedBy);
  successRes(res, data, "Assignment duplicated", 201);
});

export const listGlobalSubmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const assignmentId = req.query.assignmentId as string | undefined;
  const trainerId = req.query.trainerId as string | undefined;
  const status = req.query.status as string | undefined;

  const filters: globalSubmissionService.ListGlobalSubmissionsFilters = {};
  if (assignmentId) filters.assignmentId = assignmentId;
  if (status) filters.status = status;
  if (trainerId) filters.trainerId = trainerId;
  if (isTrainer(req)) filters.trainerId = userId;

  const data = await globalSubmissionService.listGlobalSubmissions(filters);
  successRes(res, data);
});

export const reviewGlobalSubmission = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const submissionId = req.params.id ?? req.params.subId;
  const reviewedBy = getUserId(req);
  const { status, feedback } = req.body ?? {};
  if (!submissionId) throw new AppError("Submission ID is required", 400);
  if (status !== "APPROVED" && status !== "REJECTED") throw new AppError("status must be APPROVED or REJECTED", 400);

  const data = await globalSubmissionService.reviewGlobalSubmission({
    submissionId,
    status,
    feedback,
    reviewedBy,
    trainerIdOnly: isTrainer(req) ? reviewedBy : undefined,
  });
  successRes(res, data, "Submission reviewed");
});

/** Bulk approve or reject global assignment submissions. Body: { submissionIds: string[], status: "APPROVED" | "REJECTED", feedback?: string }. */
export const bulkReviewGlobalSubmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const reviewedBy = getUserId(req);
  const { submissionIds, status, feedback } = req.body ?? {};
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    throw new AppError("submissionIds must be a non-empty array", 400);
  }
  if (status !== "APPROVED" && status !== "REJECTED") {
    throw new AppError("status must be APPROVED or REJECTED", 400);
  }
  const data = await globalSubmissionService.bulkReviewGlobalSubmissions({
    submissionIds,
    status,
    feedback: typeof feedback === "string" ? feedback : undefined,
    reviewedBy,
    trainerIdOnly: isTrainer(req) ? reviewedBy : undefined,
  });
  successRes(res, data, "Bulk review completed");
});

/** List submissions for one assignment. Only general submissions when type=general; module-linked are reviewed in Batches. */
export const getSubmissionsForAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assignmentId = req.params.id;
  if (!assignmentId) throw new AppError("Assignment ID is required", 400);
  const assignment = await service.getAssignmentById(assignmentId);
  const isGeneral = (assignment as { type?: string }).type === "general";
  if (!isGeneral) {
    successRes(res, {
      assignment: { id: assignment.id, title: assignment.title },
      moduleSubmissions: [],
      generalSubmissions: [],
      message: "Module-linked assignment submissions are reviewed in Batches → [batch] → Assignment submissions.",
    });
    return;
  }
  const generalSubmissions = await globalSubmissionService.listGlobalSubmissions({ assignmentId });
  const generalWithType = generalSubmissions.map((s) => ({ ...s, type: "general" as const }));
  successRes(res, {
    assignment: { id: assignment.id, title: assignment.title },
    moduleSubmissions: [],
    generalSubmissions: generalWithType,
  });
});

/** List students who have access to this assignment (type=general). */
export const listAssignmentAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Assignment ID is required", 400);
  const data = await service.listAllowedStudents(id);
  successRes(res, data);
});

/** Add one student to assignment access by FUNT ID or user ID. */
export const addAssignmentAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Assignment ID is required", 400);
  const { funtId } = req.body ?? {};
  const identifier = (req.body?.studentId ?? funtId ?? req.body?.identifier) as string | undefined;
  if (!identifier) throw new AppError("studentId or funtId is required", 400);
  const data = await service.addAllowedStudent(id, identifier, performedBy);
  successRes(res, data, "Student added to access list");
});

/** Remove one student from assignment access. */
export const removeAssignmentAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const studentId = req.params.studentId;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Assignment ID is required", 400);
  if (!studentId) throw new AppError("Student ID is required", 400);
  const data = await service.removeAllowedStudent(id, studentId, performedBy);
  successRes(res, data, "Student removed from access list");
});

/** Bulk add students to assignment access (body: { identifiers: string[] } – FUNT IDs or user IDs). */
export const bulkAddAssignmentAccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Assignment ID is required", 400);
  const identifiers = (req.body?.identifiers ?? req.body?.funtIds ?? []) as string[];
  if (!Array.isArray(identifiers)) throw new AppError("identifiers must be an array", 400);
  const data = await service.bulkAddAllowedStudents(id, identifiers, performedBy);
  successRes(res, data, "Bulk add completed");
});
