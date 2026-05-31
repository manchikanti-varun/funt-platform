
import type { Request, Response } from "express";
import * as service from "../services/globalModule.service.js";
import { successRes } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

export const createModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  const { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId } = req.body ?? {};
  const data = await service.createModule({
    title,
    description,
    content,
    youtubeUrl,
    videoUrl,
    resourceLinkUrl,
    linkedAssignmentId,
    createdBy,
  });
  successRes(res, data, "Chapter created", 201);
});

export const listModules = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const search = (req.query.search ?? req.query.q) as string | undefined;
  const courseId = req.query.courseId as string | undefined;
  const data = await service.listModules({
    ...(status && { status }),
    ...(search && { search }),
    ...(courseId && { courseId }),
  });
  successRes(res, data);
});

export const getModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Chapter ID is required", 400);
  const data = await service.getModuleById(id);
  successRes(res, data);
});

export const updateModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Chapter ID is required", 400);
  const { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId } = req.body ?? {};
  const data = await service.updateModule(
    id,
    { title, description, content, youtubeUrl, videoUrl, resourceLinkUrl, linkedAssignmentId },
    performedBy
  );
  successRes(res, data, "Chapter updated");
});

export const archiveModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Chapter ID is required", 400);
  const data = await service.archiveModule(id, performedBy);
  successRes(res, data, "Chapter archived");
});

export const unarchiveModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Chapter ID is required", 400);
  const data = await service.unarchiveModule(id, performedBy);
  successRes(res, data, "Chapter unarchived");
});

export const deleteModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Chapter ID is required", 400);
  const data = await service.deleteModule(id, performedBy);
  successRes(res, data, "Chapter deleted");
});

export const duplicateModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  if (!id) throw new AppError("Chapter ID is required", 400);
  const data = await service.duplicateModule(id, performedBy);
  successRes(res, data, "Chapter duplicated", 201);
});

export const restoreVersion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const performedBy = getUserId(req);
  const version = Number(req.body?.version);
  if (!id) throw new AppError("Chapter ID is required", 400);
  if (version === undefined || Number.isNaN(version)) throw new AppError("version is required (number)", 400);
  const data = await service.restoreVersionCopy(id, version, performedBy);
  successRes(res, data, "Version restored");
});
