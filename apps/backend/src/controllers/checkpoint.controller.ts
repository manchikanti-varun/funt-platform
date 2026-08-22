import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import * as checkpointService from "../services/checkpoint.service.js";
import { GlobalModuleModel } from "../models/GlobalModule.model.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function getModuleVideoKey(mod: Record<string, unknown>): string {
  const videoUrl = (mod as { videoUrl?: string }).videoUrl ?? "";
  if (!videoUrl.startsWith("r2://")) {
    throw new AppError("Checkpoints require an R2-hosted video (MP4 upload)", 400);
  }
  return videoUrl;
}

// ─── Admin: Create checkpoint ─────────────────────────────────────────────────

export const createCheckpoint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleId = req.params.moduleId;
  if (!moduleId) throw new AppError("moduleId is required", 400);

  const mod = await GlobalModuleModel.findById(moduleId).lean().exec();
  if (!mod) throw new AppError("Module not found", 404);
  const videoKey = getModuleVideoKey(mod as Record<string, unknown>);

  const result = await checkpointService.createCheckpoint({
    moduleId,
    videoKey,
    ...req.body,
    createdBy: getUserId(req),
  });

  successRes(res, result, "Checkpoint created", 201);
});

// ─── Admin: Update checkpoint ─────────────────────────────────────────────────

export const updateCheckpoint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { checkpointId } = req.params;
  if (!checkpointId) throw new AppError("checkpointId is required", 400);

  const result = await checkpointService.updateCheckpoint(checkpointId, req.body);
  successRes(res, result, "Checkpoint updated");
});

// ─── Admin: Delete checkpoint ─────────────────────────────────────────────────

export const deleteCheckpoint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { checkpointId } = req.params;
  if (!checkpointId) throw new AppError("checkpointId is required", 400);

  const result = await checkpointService.deleteCheckpoint(checkpointId);
  successRes(res, result, "Checkpoint deleted");
});

// ─── Admin: List checkpoints for a module ─────────────────────────────────────

export const listCheckpoints = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleId = req.params.moduleId;
  if (!moduleId) throw new AppError("moduleId is required", 400);

  const checkpoints = await checkpointService.listCheckpoints(moduleId);
  successRes(res, checkpoints);
});

// ─── Admin: Bulk import checkpoints ───────────────────────────────────────────

export const bulkImportCheckpoints = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleId = req.params.moduleId;
  if (!moduleId) throw new AppError("moduleId is required", 400);

  const mod = await GlobalModuleModel.findById(moduleId).lean().exec();
  if (!mod) throw new AppError("Module not found", 404);
  const videoKey = getModuleVideoKey(mod as Record<string, unknown>);

  const { checkpoints } = req.body;
  const result = await checkpointService.bulkImportCheckpoints(
    moduleId,
    videoKey,
    checkpoints,
    getUserId(req)
  );

  successRes(res, result, `${result.imported} checkpoints imported`, 201);
});

// ─── Admin: Duplicate checkpoints from another module ─────────────────────────

export const duplicateCheckpoints = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleId = req.params.moduleId;
  if (!moduleId) throw new AppError("moduleId is required", 400);

  const mod = await GlobalModuleModel.findById(moduleId).lean().exec();
  if (!mod) throw new AppError("Target module not found", 404);
  const videoKey = getModuleVideoKey(mod as Record<string, unknown>);

  const { sourceModuleId } = req.body;
  const result = await checkpointService.duplicateCheckpoints(
    sourceModuleId,
    moduleId,
    videoKey,
    getUserId(req)
  );

  successRes(res, result, `${result.duplicated} checkpoints duplicated`, 201);
});

// ─── Admin: Export checkpoints as JSON ────────────────────────────────────────

export const exportCheckpoints = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleId = req.params.moduleId;
  if (!moduleId) throw new AppError("moduleId is required", 400);

  const data = await checkpointService.exportCheckpoints(moduleId);
  successRes(res, data);
});

// ─── Student: Get checkpoints (without answers) ──────────────────────────────

export const getStudentCheckpoints = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const moduleId = typeof req.query.moduleId === "string" ? req.query.moduleId.trim() : "";
  if (!moduleId) throw new AppError("moduleId query param is required", 400);

  const checkpoints = await checkpointService.getStudentCheckpoints(moduleId);
  successRes(res, checkpoints);
});

// ─── Student: Get progress ────────────────────────────────────────────────────

export const getStudentProgress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const moduleId = typeof req.query.moduleId === "string" ? req.query.moduleId.trim() : "";
  if (!moduleId) throw new AppError("moduleId query param is required", 400);

  const progress = await checkpointService.getStudentProgress(userId, moduleId);
  successRes(res, progress);
});

// ─── Student: Submit answer ───────────────────────────────────────────────────

export const submitAnswer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { checkpointId } = req.params;
  if (!checkpointId) throw new AppError("checkpointId is required", 400);

  const { selectedOptionId, selectedOptionIds, textAnswer, moduleId } = req.body;

  const result = await checkpointService.submitAnswer({
    userId,
    checkpointId,
    moduleId,
    selectedOptionId,
    selectedOptionIds,
    textAnswer,
  });

  successRes(res, result);
});

// ─── Student: Save video position ─────────────────────────────────────────────

export const savePosition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { moduleId, position } = req.body;

  await checkpointService.saveVideoPosition(userId, moduleId, position);
  successRes(res, { saved: true });
});
