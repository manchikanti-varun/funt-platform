/**
 * Enrollment controller – create (admin), my enrollments (student), batch course (student).
 */

import type { Request, Response } from "express";
import * as enrollmentService from "../services/enrollment.service.js";
import { getBatchCourseForStudent, getCourseForStudentByCourseId, getMyCoursesForStudent, listCoursesForExplore, markModuleComplete, markModulePartComplete, type ModulePart } from "../services/studentCourse.service.js";
import * as batchService from "../services/batch.service.js";
import * as globalAssignmentService from "../services/globalAssignment.service.js";
import { submitGlobalAssignment, listGeneralSubmissionsByStudentId } from "../services/globalAssignmentSubmission.service.js";
import { listModuleSubmissionsByStudentId } from "../services/assignmentSubmission.service.js";
import * as enrollmentRequestService from "../services/enrollmentRequest.service.js";
import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createEnrollment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { studentId, batchId } = req.body ?? {};
  const data = await enrollmentService.createEnrollment({ studentId, batchId, createdBy });
  successRes(res, data, "Enrollment created", 201);
});

/** Admin: bulk enroll students in a batch (JSON body: batchId, studentFuntIds). */
export const postBulkEnrollment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { batchId, studentFuntIds } = req.body ?? {};
  if (!batchId) throw new AppError("batchId is required", 400);
  const ids = Array.isArray(studentFuntIds) ? studentFuntIds : [];
  const data = await enrollmentService.bulkEnroll(batchId, ids, createdBy);
  successRes(res, data, "Bulk enrollment completed", 200);
});

export const getMyEnrollments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await enrollmentService.getMyEnrollments(studentId);
  successRes(res, data);
});

export const getBatchCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const batchId = req.params.batchId;
  if (!batchId) throw new AppError("batchId is required", 400);
  const data = await getBatchCourseForStudent(studentId, batchId);
  successRes(res, data);
});

/** List my courses (course-centric; one per course; batch not exposed to user). */
export const getMyCourses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await getMyCoursesForStudent(studentId);
  successRes(res, data);
});

/** Get course by courseId (and optional batchId when batch has multiple courses). */
export const getCourseByCourseId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const courseId = req.params.courseId;
  const batchId = req.query.batchId as string | undefined;
  if (!courseId) throw new AppError("courseId is required", 400);
  const data = await getCourseForStudentByCourseId(studentId, courseId, batchId);
  successRes(res, data);
});

/** List all courses for explore (unique by course; batch hidden). */
export const getExploreCourses = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await listCoursesForExplore();
  successRes(res, data);
});

/** List all batches for student explore – legacy; prefer getExploreCourses. */
export const getExploreBatches = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await batchService.listAllBatchesForExplore();
  successRes(res, data);
});

/** List published general assignments for this student (only those they have access to). */
export const getGeneralAssignments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await globalAssignmentService.listPublishedForStudent(studentId);
  successRes(res, data);
});

/** Get one assignment by id (for in-module submit form: title, instructions, submissionType). Optional query: batchId, courseId, moduleOrder to apply assignment copy overrides from the course. */
export const getAssignmentForStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const assignmentId = req.params.assignmentId;
  const batchId = req.query.batchId as string | undefined;
  const courseId = req.query.courseId as string | undefined;
  const moduleOrderParam = req.query.moduleOrder as string | undefined;
  if (!assignmentId) throw new AppError("Assignment ID is required", 400);
  let data = await globalAssignmentService.getAssignmentById(assignmentId);
  if (batchId && moduleOrderParam != null) {
    const moduleOrder = parseInt(moduleOrderParam, 10);
    if (!Number.isNaN(moduleOrder)) {
      const overrides = await batchService.getModuleAssignmentOverrides(batchId, courseId ?? undefined, moduleOrder);
      if (overrides) {
        data = {
          ...data,
          title: overrides.title ?? data.title,
          instructions: overrides.instructions ?? data.instructions,
          ...(overrides.submissionType && { submissionType: overrides.submissionType }),
          ...(overrides.skillTags && { skillTags: overrides.skillTags }),
        };
      }
    }
  }
  successRes(res, data);
});

/** Student marks current module (or one part) as complete. Body: { moduleOrder, part?, courseId? }. */
export const postMarkModuleComplete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const batchId = req.params.batchId;
  const moduleOrder = Number(req.body?.moduleOrder);
  const part = req.body?.part as ModulePart | undefined;
  const courseId = req.body?.courseId as string | undefined;
  if (!batchId) throw new AppError("batchId is required", 400);
  if (moduleOrder === undefined || Number.isNaN(moduleOrder) || moduleOrder < 0) {
    throw new AppError("moduleOrder is required and must be a non-negative number", 400);
  }
  const validParts: ModulePart[] = ["content", "video", "youtube"];
  if (part != null && validParts.includes(part)) {
    const data = await markModulePartComplete(studentId, batchId, moduleOrder, part, courseId);
    successRes(res, data, "Part marked as complete");
    return;
  }
  const data = await markModuleComplete(studentId, batchId, moduleOrder, courseId);
  successRes(res, data, "Module marked as complete");
});

/** List all trainers (id, funtId, name) for student dropdown. */
export const getTrainers = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const list = await UserModel.find({ roles: ROLE.TRAINER }).select("funtId name").lean().exec();
  const data = list.map((u) => ({ id: String(u._id), funtId: u.funtId, name: u.name }));
  successRes(res, data);
});

/** Student requests enrollment (by batchId or courseId; request goes to admin who created the batch). */
export const postEnrollmentRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId, courseId } = req.body ?? {};
  const data = await enrollmentRequestService.createEnrollmentRequest(studentId, { batchId, courseId });
  successRes(res, data, data.message, 201);
});

/** Admin: list pending enrollment requests for batches they created. Optional ?batchId= to filter by batch. */
export const getEnrollmentRequestsForAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = getUserId(req);
  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : undefined;
  const data = await enrollmentRequestService.listEnrollmentRequestsForAdmin(adminId, batchId);
  successRes(res, data);
});

/** Admin: approve or reject an enrollment request. */
export const respondToEnrollmentRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = getUserId(req);
  const requestId = req.params.id;
  const { action } = req.body ?? {};
  if (!requestId) throw new AppError("Request ID is required", 400);
  const normalizedAction = String(action).toUpperCase() === "REJECT" ? "REJECT" : "APPROVE";
  const data = await enrollmentRequestService.respondToEnrollmentRequest(requestId, normalizedAction, adminId);
  successRes(res, data, data.message, 200);
});

/** Student submits to a global (in-class) assignment. */
export const postSubmitGlobalAssignment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { assignmentId, submissionType, submissionContent } = req.body ?? {};
  if (!assignmentId || !submissionType || submissionContent == null) {
    throw new AppError("assignmentId, submissionType, and submissionContent are required", 400);
  }
  const data = await submitGlobalAssignment({
    studentId,
    assignmentId: String(assignmentId),
    submissionType: String(submissionType),
    submissionContent: String(submissionContent),
  });
  successRes(res, data, "Successfully submitted", 201);
});

/** Student: list my submissions (module + general) with feedback for viewing. */
export const getMySubmissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const [moduleSubmissions, generalSubmissions] = await Promise.all([
    listModuleSubmissionsByStudentId(studentId),
    listGeneralSubmissionsByStudentId(studentId),
  ]);
  successRes(res, { moduleSubmissions, generalSubmissions });
});
