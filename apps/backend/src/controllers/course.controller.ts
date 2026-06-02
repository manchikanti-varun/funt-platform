
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
  const { title, description, durationText, headerImageUrl, isDemo, globalChapterIds, globalModuleIds } = req.body ?? {};
  const data = await service.createCourse({
    title,
    description,
    durationText,
    headerImageUrl: typeof headerImageUrl === "string" ? headerImageUrl : undefined,
    isDemo: isDemo === true || isDemo === "true",
    globalChapterIds: globalChapterIds ?? globalModuleIds,
    createdBy,
  });
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
  const { title, description, durationText, headerImageUrl, isDemo, moderatorIds, ageGroup, certification, paymentNote, learningOutcomes, overview, pricingTiers } = req.body ?? {};
  const body = req.body ?? {};
  const headerPatch =
    "headerImageUrl" in body
      ? headerImageUrl === null
        ? null
        : typeof headerImageUrl === "string"
          ? headerImageUrl
          : null
      : undefined;
  const data = await service.updateCourse(
    id,
    {
      title,
      description,
      durationText,
      headerImageUrl: headerPatch,
      isDemo: "isDemo" in body ? isDemo === true || isDemo === "true" : undefined,
      moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : undefined,
      ageGroup: typeof ageGroup === "string" ? ageGroup : undefined,
      certification: typeof certification === "string" ? certification : undefined,
      paymentNote: typeof paymentNote === "string" ? paymentNote : undefined,
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes.filter((l: unknown) => typeof l === "string" && l.trim()) : undefined,
      overview: typeof overview === "string" ? overview : undefined,
      pricingTiers: Array.isArray(pricingTiers) ? pricingTiers : undefined,
    },
    performedBy
  );
  successRes(res, data, "Course updated");
});

export const reorderModules = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const { orderedModuleIndices } = req.body ?? {};
  const data = await service.reorderModules(id, { orderedModuleIndices }, performedBy);
  successRes(res, data, "Chapters reordered");
});

export const updateCourseModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const indexParam = req.params.index;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const moduleIndex = indexParam != null ? parseInt(indexParam, 10) : NaN;
  if (Number.isNaN(moduleIndex) || moduleIndex < 0) throw new AppError("Valid chapter index is required", 400);
  const { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId, linkedAssignmentTitleOverride, linkedAssignmentInstructionsOverride, linkedAssignmentSubmissionTypeOverride, linkedAssignmentSkillTagsOverride, xpReward } = req.body ?? {};
  const data = await service.updateCourseModule(
    id,
    moduleIndex,
    { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId, linkedAssignmentTitleOverride, linkedAssignmentInstructionsOverride, linkedAssignmentSubmissionTypeOverride, linkedAssignmentSkillTagsOverride: Array.isArray(linkedAssignmentSkillTagsOverride) ? linkedAssignmentSkillTagsOverride : undefined, xpReward },
    performedBy
  );
  successRes(res, data, "Chapter snapshot updated");
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

export const unarchiveCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.unarchiveCourse(id, performedBy);
  successRes(res, data, "Course unarchived");
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.deleteCourse(id, performedBy);
  successRes(res, data, "Course deleted");
});

/** Public — returns courses with status LAUNCHING_SOON for marketing/explore pages. */
export const getUpcomingCourses = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await service.listUpcomingCourses();
  successRes(res, data);
});

export const setLaunchingSoon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.setCourseLaunchingSoon(id, performedBy);
  successRes(res, data, "Course marked as launching soon");
});
