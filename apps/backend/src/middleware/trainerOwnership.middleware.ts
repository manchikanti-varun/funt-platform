/**
 * Trainer Ownership Middleware
 *
 * Ensures that a TRAINER role user can only modify batches they are assigned to.
 * ADMIN and SUPER_ADMIN bypass this check.
 *
 * Usage:
 *   router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), requireBatchOwnership, updateBatch);
 */

import type { Request, Response, NextFunction } from "express";
import { ROLE } from "@funt-platform/constants";
import { BatchModel } from "../models/Batch.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Checks if the current user (TRAINER) owns the batch identified by `req.params.id`.
 * Admins and Super Admins bypass this check entirely.
 */
export function requireBatchOwnership(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError("Unauthorized", 401));
    return;
  }

  const userRoles = req.user.roles as string[];
  const isAdminOrAbove = userRoles.includes(ROLE.ADMIN) || userRoles.includes(ROLE.SUPER_ADMIN);

  // Admins and Super Admins can modify any batch
  if (isAdminOrAbove) {
    next();
    return;
  }

  // For trainers: verify ownership
  const batchId = req.params.id;
  if (!batchId) {
    next(new AppError("Batch ID is required", 400));
    return;
  }

  void verifyTrainerOwnership(req.user.userId, batchId, next);
}

async function verifyTrainerOwnership(
  userId: string,
  batchId: string,
  next: NextFunction
): Promise<void> {
  try {
    // Try finding by MongoDB _id first, then by human batchId
    let batch = await BatchModel.findById(batchId).select("trainerId moderatorIds").lean().exec();
    if (!batch) {
      batch = await BatchModel.findOne({ batchId }).select("trainerId moderatorIds").lean().exec();
    }

    if (!batch) {
      next(new AppError("Batch not found", 404));
      return;
    }

    const trainerId = String((batch as { trainerId?: string }).trainerId ?? "");
    const moderatorIds: string[] = ((batch as { moderatorIds?: string[] }).moderatorIds ?? []).map(String);

    const isOwner = trainerId === userId;
    const isModerator = moderatorIds.includes(userId);

    if (!isOwner && !isModerator) {
      next(new AppError("Forbidden: you can only modify batches assigned to you", 403));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
