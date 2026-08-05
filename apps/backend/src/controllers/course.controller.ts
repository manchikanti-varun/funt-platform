
import type { Request, Response } from "express";
import * as service from "../services/course.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "../utils/cache.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createCourse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { title, description, durationText, headerImageUrl, isDemo, ageGroup, levelTag, globalChapterIds, globalModuleIds } = req.body ?? {};
  const data = await service.createCourse({
    title,
    description,
    durationText,
    headerImageUrl: typeof headerImageUrl === "string" ? headerImageUrl : undefined,
    isDemo: isDemo === true || isDemo === "true",
    ageGroup: typeof ageGroup === "string" ? ageGroup.trim() : undefined,
    levelTag: typeof levelTag === "string" ? levelTag.trim() : undefined,
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
  const { title, description, durationText, headerImageUrl, isDemo, moderatorIds, ageGroup, certification, levelTag, learningOutcomes, overview, cardDescription, cardIncludes, courseImages, courseFaqs, enableWatermark } = req.body ?? {};
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
      levelTag: typeof levelTag === "string" ? levelTag : undefined,
      learningOutcomes: Array.isArray(learningOutcomes) ? learningOutcomes.filter((l: unknown) => typeof l === "string" && l.trim()) : undefined,
      overview: typeof overview === "string" ? overview : undefined,
      cardDescription: typeof cardDescription === "string" ? cardDescription : undefined,
      cardIncludes: Array.isArray(cardIncludes) ? cardIncludes.filter((l: unknown) => typeof l === "string" && l.trim()) : undefined,
      courseImages: Array.isArray(courseImages) ? courseImages.filter((u: unknown) => typeof u === "string" && u.trim()) : undefined,
      courseFaqs: Array.isArray(courseFaqs) ? courseFaqs : undefined,
      ...("enableWatermark" in body ? { enableWatermark: enableWatermark === true ? true : enableWatermark === false ? false : null } : {}),
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
  const { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, downloadableFiles, linkedAssignmentId, linkedAssignmentTitleOverride, linkedAssignmentInstructionsOverride, linkedAssignmentSubmissionTypeOverride, linkedAssignmentSkillTagsOverride, linkedQuizId, xpReward } = req.body ?? {};
  const data = await service.updateCourseModule(
    id,
    moduleIndex,
    { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, downloadableFiles, linkedAssignmentId, linkedAssignmentTitleOverride, linkedAssignmentInstructionsOverride, linkedAssignmentSubmissionTypeOverride, linkedAssignmentSkillTagsOverride: Array.isArray(linkedAssignmentSkillTagsOverride) ? linkedAssignmentSkillTagsOverride : undefined, linkedQuizId, xpReward },
    performedBy
  );
  successRes(res, data, "Chapter snapshot updated");
});

export const addChapter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const { globalModuleId } = req.body ?? {};
  if (!globalModuleId) throw new AppError("globalModuleId is required", 400);
  const data = await service.addChapterToCourse(id, globalModuleId, performedBy);
  successRes(res, data, "Chapter added to course", 201);
});

export const removeChapter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  const indexParam = req.params.index;
  if (!id) throw new AppError("Course ID is required", 400);
  const chapterIndex = indexParam != null ? parseInt(indexParam, 10) : NaN;
  if (Number.isNaN(chapterIndex) || chapterIndex < 0) throw new AppError("Valid chapter index is required", 400);
  const data = await service.removeChapterFromCourse(id, chapterIndex, performedBy);
  successRes(res, data, "Chapter removed from course");
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

export const bulkDeleteCourses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const performedBy = getUserId(req);
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("ids array is required", 400);
  }
  if (ids.length > 50) {
    throw new AppError("Cannot delete more than 50 courses at once", 400);
  }
  const results: { id: string; deleted: boolean; error?: string }[] = [];
  for (const id of ids) {
    try {
      await service.deleteCourse(id, performedBy);
      results.push({ id, deleted: true });
    } catch (err) {
      results.push({ id, deleted: false, error: err instanceof AppError ? err.message : "Failed to delete" });
    }
  }
  const deleted = results.filter((r) => r.deleted).length;
  const failed = results.filter((r) => !r.deleted).length;
  successRes(res, { results, deleted, failed }, `Deleted ${deleted} course(s), ${failed} failed`);
});

/** Public — returns courses with status LAUNCHING_SOON for marketing/explore pages. */
export const getUpcomingCourses = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const cached = await cacheGet(CACHE_KEYS.upcomingCourses());
  if (cached) {
    successRes(res, cached);
    return;
  }
  const data = await service.listUpcomingCourses();
  await cacheSet(CACHE_KEYS.upcomingCourses(), data, CACHE_TTL.EXPLORE);
  successRes(res, data);
});

export const setLaunchingSoon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Course ID is required", 400);
  const data = await service.setCourseLaunchingSoon(id, performedBy);
  successRes(res, data, "Course marked as launching soon");
});
