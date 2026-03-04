
import type { Request, Response } from "express";
import * as service from "../services/course.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { title, description, globalModuleIds } = req.body ?? {};
  const data = await service.createCourse({ title, description, globalModuleIds, createdBy });
  successRes(res, data, "Course created", 201);
});

export const listCourses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = (req.query.search ?? req.query.q) as string | undefined;
  const data = await service.listCourses({ ...(status && { status }), ...(search && { search }) });
  successRes(res, data);
});

export const getCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.getCourseById(id);
  successRes(res, data);
});

export const updateCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const { title, description, moderatorIds } = req.body ?? {};
  const data = await service.updateCourse(id, { title, description, moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : undefined }, performedBy);
  successRes(res, data, "Course updated");
});

export const reorderModules = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const { orderedModuleIndices } = req.body ?? {};
  const data = await service.reorderModules(id, { orderedModuleIndices }, performedBy);
  successRes(res, data, "Modules reordered");
});

export const updateCourseModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const indexParam = req.params.index;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const moduleIndex = indexParam != null ? parseInt(indexParam, 10) : NaN;
  if (Number.isNaN(moduleIndex) || moduleIndex < 0) throw new AppError("Valid module index is required", 400);
  const { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId, linkedAssignmentTitleOverride, linkedAssignmentInstructionsOverride, linkedAssignmentSubmissionTypeOverride, linkedAssignmentSkillTagsOverride } = req.body ?? {};
  const data = await service.updateCourseModule(
    id,
    moduleIndex,
    { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId, linkedAssignmentTitleOverride, linkedAssignmentInstructionsOverride, linkedAssignmentSubmissionTypeOverride, linkedAssignmentSkillTagsOverride: Array.isArray(linkedAssignmentSkillTagsOverride) ? linkedAssignmentSkillTagsOverride : undefined },
    performedBy
  );
  successRes(res, data, "Module snapshot updated");
});

export const duplicateCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.duplicateCourse(id, performedBy);
  successRes(res, data, "Course duplicated", 201);
});

export const archiveCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.archiveCourse(id, performedBy);
  successRes(res, data, "Course archived");
});
