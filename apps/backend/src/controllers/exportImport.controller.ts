/**
 * Import / Export Controller
 *
 * Handles:
 *   - POST /api/admin/export          — generate + stream ZIP export
 *   - POST /api/admin/import/preview  — preview import (conflict detection)
 *   - POST /api/admin/import          — execute import
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import { ROLE } from "@funt-platform/constants";
import {
  streamExportZip,
  previewImport,
  executeImport,
  type ExportLevel,
  type ImportMode,
  type ManifestJson,
} from "../services/exportImport.service.js";

function uid(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

/**
 * POST /api/admin/export
 * Body: { level: 1|2|3|4, courseIds?: string[], batchIds?: string[], includeMedia?: boolean }
 * Response: ZIP file download
 */
export const postExport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const body = req.body as {
    level?: number;
    courseIds?: string[];
    batchIds?: string[];
    includeMedia?: boolean;
  };

  const level = Math.floor(Number(body.level ?? 1));
  if (level < 1 || level > 4) throw new AppError("level must be 1, 2, 3, or 4", 400);

  // Level 3-4 exports require SUPER_ADMIN
  const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  if (level >= 3 && !isSuperAdmin) {
    throw new AppError("Level 3-4 exports require Super Admin access", 403);
  }

  const filename = `funt-export-L${level}-${new Date().toISOString().slice(0, 10)}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");

  await streamExportZip(res, {
    level: level as ExportLevel,
    courseIds: Array.isArray(body.courseIds) ? body.courseIds : undefined,
    batchIds: Array.isArray(body.batchIds) ? body.batchIds : undefined,
    includeMedia: !!body.includeMedia,
    exportedBy: actorId,
  });
});

/**
 * POST /api/admin/import/preview
 * Body: { manifest: ManifestJson, courses: [], batches: [] }
 * Response: ImportPreviewResult (conflicts + entity counts)
 */
export const postImportPreview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    manifest?: ManifestJson;
    courses?: unknown[];
    batches?: unknown[];
  };

  if (!body.manifest) throw new AppError("manifest is required", 400);
  if (body.manifest.platform !== "funt") throw new AppError("Invalid package: not a FUNT export", 400);
  if (body.manifest.version !== "1.0.0") throw new AppError("Unsupported export version", 400);

  const result = await previewImport(
    body.manifest,
    body.courses ?? [],
    body.batches ?? []
  );

  successRes(res, result, "Import preview generated");
});

/**
 * POST /api/admin/import
 * Body: {
 *   mode: "CREATE_NEW" | "MERGE" | "REPLACE",
 *   manifest: ManifestJson,
 *   courses: [], globalModules: [], globalAssignments: [],
 *   batches: [], licenseKeys: [], coupons: [], shopProducts: [], badgeDefinitions: []
 * }
 * Response: ImportResult
 */
export const postImport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const body = req.body as {
    mode?: string;
    manifest?: ManifestJson;
    courses?: unknown[];
    globalModules?: unknown[];
    globalAssignments?: unknown[];
    batches?: unknown[];
    licenseKeys?: unknown[];
    coupons?: unknown[];
    shopProducts?: unknown[];
    badgeDefinitions?: unknown[];
  };

  if (!body.manifest) throw new AppError("manifest is required", 400);
  if (body.manifest.platform !== "funt") throw new AppError("Invalid package: not a FUNT export", 400);

  // Level 3-4 data (coupons, shop, badges, license keys) requires SUPER_ADMIN
  const isSuperAdmin = req.user?.roles?.includes(ROLE.SUPER_ADMIN);
  const hasLevel34Data = (body.licenseKeys?.length ?? 0) > 0 ||
    (body.coupons?.length ?? 0) > 0 ||
    (body.shopProducts?.length ?? 0) > 0 ||
    (body.badgeDefinitions?.length ?? 0) > 0;
  if (hasLevel34Data && !isSuperAdmin) {
    throw new AppError("Importing license keys, coupons, shop products, or badges requires Super Admin access", 403);
  }

  // REPLACE mode is destructive — require SUPER_ADMIN
  const mode: ImportMode =
    body.mode === "MERGE" ? "MERGE" :
    body.mode === "REPLACE" ? "REPLACE" :
    "CREATE_NEW";
  if (mode === "REPLACE" && !isSuperAdmin) {
    throw new AppError("REPLACE import mode requires Super Admin access", 403);
  }

  const result = await executeImport(
    {
      courses: body.courses ?? [],
      globalModules: body.globalModules ?? [],
      globalAssignments: body.globalAssignments ?? [],
      batches: body.batches ?? [],
      licenseKeys: body.licenseKeys ?? [],
      coupons: body.coupons ?? [],
      shopProducts: body.shopProducts ?? [],
      badgeDefinitions: body.badgeDefinitions ?? [],
    },
    mode,
    actorId
  );

  successRes(res, result, `Import completed: ${result.imported.courses} courses, ${result.imported.batches} batches`);
});
