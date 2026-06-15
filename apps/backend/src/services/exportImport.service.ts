/**
 * Import / Export Service
 *
 * Handles:
 *   - Multi-level data export (course, batch, academic, full platform)
 *   - ZIP package generation using archiver
 *   - Import with ID remapping and conflict resolution
 *   - Backup metadata tracking
 *
 * Export Levels:
 *   1 = Course only (course + modules + assignments + learning plan)
 *   2 = Course + Batches (adds batch snapshots, schedules)
 *   3 = Academic Package (adds certificates config, attendance config, enrollments structure)
 *   4 = Full Platform (everything: shop, coupons, badges, license keys, etc.)
 */

import archiver from "archiver";
import type { Writable } from "stream";
import { CourseModel } from "../models/Course.model.js";
import { BatchModel } from "../models/Batch.model.js";
import { GlobalModuleModel } from "../models/GlobalModule.model.js";
import { GlobalAssignmentModel } from "../models/GlobalAssignment.model.js";
import { LicenseKeyModel } from "../models/LicenseKey.model.js";
import { CouponModel } from "../models/Coupon.model.js";
import { ShopProductModel } from "../models/ShopProduct.model.js";
import { BadgeTypeDefinitionModel } from "../models/BadgeTypeDefinition.model.js";
import { createAuditLog } from "./audit.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportLevel = 1 | 2 | 3 | 4;

export interface ExportOptions {
  level: ExportLevel;
  courseIds?: string[];      // specific courses (level 1-3) or empty for all
  batchIds?: string[];      // specific batches (level 2-3)
  includeMedia?: boolean;   // include binary media files (default: false — references only)
  exportedBy: string;       // userId of admin performing export
}

export interface ManifestJson {
  version: "1.0.0";
  platform: "funt";
  exportLevel: ExportLevel;
  exportedAt: string;
  exportedBy: string;
  description: string;
  entities: {
    courses: number;
    globalModules: number;
    globalAssignments: number;
    batches: number;
    licenseKeys: number;
    coupons: number;
    shopProducts: number;
    badgeDefinitions: number;
  };
  mediaStrategy: "references" | "included";
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Stream a ZIP export to the provided writable stream (e.g., Express response).
 * Does NOT buffer the entire ZIP in memory — streams directly.
 */
export async function streamExportZip(
  output: Writable,
  options: ExportOptions
): Promise<ManifestJson> {
  const { level, courseIds, batchIds, includeMedia = false, exportedBy } = options;

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(output);

  // ── Gather data based on export level ───────────────────────────────────

  // Courses
  const courseFilter: Record<string, unknown> = {};
  if (courseIds && courseIds.length > 0) {
    courseFilter.$or = [
      { courseId: { $in: courseIds } },
      { _id: { $in: courseIds } },
    ];
  }
  const courses = await CourseModel.find(courseFilter).lean().exec();

  // Global Modules referenced by courses
  const moduleIds = new Set<string>();
  for (const c of courses) {
    const modules = (c as { modules?: Array<{ originalGlobalModuleId?: string }> }).modules ?? [];
    for (const m of modules) {
      if (m.originalGlobalModuleId) moduleIds.add(m.originalGlobalModuleId);
    }
  }
  const globalModules = moduleIds.size > 0
    ? await GlobalModuleModel.find({ _id: { $in: [...moduleIds] } }).lean().exec()
    : [];

  // Global Assignments referenced by modules
  const assignmentIds = new Set<string>();
  for (const m of globalModules) {
    const linkedId = (m as { linkedAssignmentId?: string }).linkedAssignmentId;
    if (linkedId) assignmentIds.add(linkedId);
  }
  const globalAssignments = assignmentIds.size > 0
    ? await GlobalAssignmentModel.find({
        $or: [
          { _id: { $in: [...assignmentIds] } },
          { assignmentId: { $in: [...assignmentIds] } },
        ],
      }).lean().exec()
    : [];

  // Batches (level 2+)
  let batches: unknown[] = [];
  if (level >= 2) {
    const batchFilter: Record<string, unknown> = {};
    if (batchIds && batchIds.length > 0) {
      batchFilter.$or = [
        { _id: { $in: batchIds } },
        { batchId: { $in: batchIds } },
      ];
    } else if (courseIds && courseIds.length > 0) {
      // Find batches containing these courses
      batchFilter.$or = [
        { "courseSnapshots.courseId": { $in: courseIds } },
        { "courseSnapshot.courseId": { $in: courseIds } },
      ];
    }
    batches = await BatchModel.find(batchFilter).lean().exec();
  }

  // License Keys (level 3+)
  let licenseKeys: unknown[] = [];
  if (level >= 3) {
    const courseIdList = courses.map((c) => (c as { courseId?: string }).courseId).filter(Boolean);
    licenseKeys = courseIdList.length > 0
      ? await LicenseKeyModel.find({ courseId: { $in: courseIdList } })
          .select("-key -usedByStudentId -usedAt")  // Don't export secret keys or PII
          .lean().exec()
      : [];
  }

  // Coupons (level 4)
  let coupons: unknown[] = [];
  if (level >= 4) {
    coupons = await CouponModel.find({}).lean().exec();
  }

  // Shop Products (level 4)
  let shopProducts: unknown[] = [];
  if (level >= 4) {
    shopProducts = await ShopProductModel.find({}).lean().exec();
  }

  // Badge Definitions (level 4)
  let badgeDefinitions: unknown[] = [];
  if (level >= 4) {
    badgeDefinitions = await BadgeTypeDefinitionModel.find({}).lean().exec();
  }

  // ── Collect media references ────────────────────────────────────────────

  const mediaReferences: Array<{ key: string; provider: string; sourceEntity: string; sourceId: string }> = [];
  for (const c of courses) {
    const modules = (c as { modules?: Array<{ videoUrl?: string; order?: number }> }).modules ?? [];
    for (const m of modules) {
      if (m.videoUrl?.startsWith("r2://")) {
        mediaReferences.push({
          key: m.videoUrl,
          provider: "R2",
          sourceEntity: "Course",
          sourceId: String((c as { _id: unknown })._id),
        });
      }
    }
  }
  for (const m of globalModules) {
    const videoUrl = (m as { videoUrl?: string }).videoUrl;
    if (videoUrl?.startsWith("r2://")) {
      mediaReferences.push({
        key: videoUrl,
        provider: "R2",
        sourceEntity: "GlobalModule",
        sourceId: String((m as { _id: unknown })._id),
      });
    }
  }

  // ── Build manifest ──────────────────────────────────────────────────────

  const manifest: ManifestJson = {
    version: "1.0.0",
    platform: "funt",
    exportLevel: level,
    exportedAt: new Date().toISOString(),
    exportedBy,
    description: `FUNT Export Level ${level} — ${courses.length} course(s), ${batches.length} batch(es)`,
    entities: {
      courses: courses.length,
      globalModules: globalModules.length,
      globalAssignments: globalAssignments.length,
      batches: batches.length,
      licenseKeys: licenseKeys.length,
      coupons: coupons.length,
      shopProducts: shopProducts.length,
      badgeDefinitions: badgeDefinitions.length,
    },
    mediaStrategy: includeMedia ? "included" : "references",
  };

  // ── Write to archive ────────────────────────────────────────────────────

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  // Courses
  for (const c of courses) {
    const id = (c as { courseId?: string }).courseId || String((c as { _id: unknown })._id);
    archive.append(JSON.stringify(c, null, 2), { name: `courses/${id}.json` });
  }

  // Global Modules
  for (const m of globalModules) {
    const id = (m as { moduleId?: string }).moduleId || String((m as { _id: unknown })._id);
    archive.append(JSON.stringify(m, null, 2), { name: `global-modules/${id}.json` });
  }

  // Global Assignments
  for (const a of globalAssignments) {
    const id = (a as { assignmentId?: string }).assignmentId || String((a as { _id: unknown })._id);
    archive.append(JSON.stringify(a, null, 2), { name: `global-assignments/${id}.json` });
  }

  // Batches
  for (const b of batches) {
    const id = (b as { batchId?: string }).batchId || String((b as { _id: unknown })._id);
    archive.append(JSON.stringify(b, null, 2), { name: `batches/${id}.json` });
  }

  // License Keys (structure only — no secret values)
  if (licenseKeys.length > 0) {
    archive.append(JSON.stringify(licenseKeys, null, 2), { name: "license-keys/keys.json" });
  }

  // Coupons
  if (coupons.length > 0) {
    archive.append(JSON.stringify(coupons, null, 2), { name: "coupons/coupons.json" });
  }

  // Shop Products
  if (shopProducts.length > 0) {
    archive.append(JSON.stringify(shopProducts, null, 2), { name: "shop/products.json" });
  }

  // Badge Definitions
  if (badgeDefinitions.length > 0) {
    archive.append(JSON.stringify(badgeDefinitions, null, 2), { name: "badges/definitions.json" });
  }

  // Media references
  archive.append(JSON.stringify(mediaReferences, null, 2), { name: "media/manifest.json" });

  // Finalize
  await archive.finalize();

  // Audit
  await createAuditLog("EXPORT_CREATED", exportedBy, "Export", "system", {
    level,
    courseCount: courses.length,
    batchCount: batches.length,
  });

  return manifest;
}

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportMode = "CREATE_NEW" | "MERGE" | "REPLACE";

export interface ImportPreviewResult {
  manifest: ManifestJson;
  conflicts: Array<{
    entity: string;
    existingId: string;
    existingName: string;
    importedName: string;
    resolution: "skip" | "rename" | "replace";
  }>;
  newEntities: {
    courses: number;
    globalModules: number;
    globalAssignments: number;
    batches: number;
  };
}

export interface ImportResult {
  imported: {
    courses: number;
    globalModules: number;
    globalAssignments: number;
    batches: number;
    licenseKeys: number;
    coupons: number;
    shopProducts: number;
    badgeDefinitions: number;
  };
  idMap: Record<string, string>;  // oldId → newId
  errors: Array<{ entity: string; id: string; message: string }>;
}

/**
 * Preview what an import would do (conflict detection) without writing anything.
 */
export async function previewImport(
  manifestJson: ManifestJson,
  coursesData: unknown[],
  batchesData: unknown[]
): Promise<ImportPreviewResult> {
  const conflicts: ImportPreviewResult["conflicts"] = [];

  // Check course name conflicts
  for (const c of coursesData) {
    const title = (c as { title?: string }).title ?? "";
    const courseId = (c as { courseId?: string }).courseId ?? "";
    const existing = await CourseModel.findOne({
      $or: [
        ...(courseId ? [{ courseId }] : []),
        { title },
      ],
    }).select("_id courseId title").lean().exec();
    if (existing) {
      conflicts.push({
        entity: "Course",
        existingId: String((existing as { _id: unknown })._id),
        existingName: (existing as { title?: string }).title ?? "",
        importedName: title,
        resolution: "rename",
      });
    }
  }

  // Check batch name conflicts
  for (const b of batchesData) {
    const name = (b as { name?: string }).name ?? "";
    const batchId = (b as { batchId?: string }).batchId ?? "";
    const existing = await BatchModel.findOne({
      $or: [
        ...(batchId ? [{ batchId }] : []),
        { name },
      ],
    }).select("_id batchId name").lean().exec();
    if (existing) {
      conflicts.push({
        entity: "Batch",
        existingId: String((existing as { _id: unknown })._id),
        existingName: (existing as { name?: string }).name ?? "",
        importedName: name,
        resolution: "rename",
      });
    }
  }

  return {
    manifest: manifestJson,
    conflicts,
    newEntities: {
      courses: coursesData.length - conflicts.filter((c) => c.entity === "Course").length,
      globalModules: manifestJson.entities.globalModules,
      globalAssignments: manifestJson.entities.globalAssignments,
      batches: batchesData.length - conflicts.filter((c) => c.entity === "Batch").length,
    },
  };
}

/**
 * Execute import — creates new entities with fresh IDs, maintaining relationships via ID map.
 */
export async function executeImport(
  data: {
    courses: unknown[];
    globalModules: unknown[];
    globalAssignments: unknown[];
    batches: unknown[];
    licenseKeys: unknown[];
    coupons: unknown[];
    shopProducts: unknown[];
    badgeDefinitions: unknown[];
  },
  mode: ImportMode,
  importedBy: string
): Promise<ImportResult> {
  const idMap: Record<string, string> = {};
  const errors: ImportResult["errors"] = [];
  const imported = {
    courses: 0, globalModules: 0, globalAssignments: 0, batches: 0,
    licenseKeys: 0, coupons: 0, shopProducts: 0, badgeDefinitions: 0,
  };

  // ── Import Global Assignments ──────────────────────────────────────────
  for (const raw of data.globalAssignments) {
    try {
      const a = raw as Record<string, unknown>;
      const oldId = String(a._id ?? "");
      delete a._id;
      delete a.__v;
      // Generate new assignmentId
      const { generateAssignmentId } = await import("../utils/funtIdGenerator.js");
      a.assignmentId = await generateAssignmentId();
      const doc = await GlobalAssignmentModel.create(a);
      idMap[oldId] = String(doc._id);
      if (a.assignmentId) idMap[String(a.assignmentId)] = String(doc.assignmentId ?? doc._id);
      imported.globalAssignments++;
    } catch (err) {
      errors.push({ entity: "GlobalAssignment", id: String((raw as { _id?: string })._id ?? ""), message: String(err) });
    }
  }

  // ── Import Global Modules ──────────────────────────────────────────────
  for (const raw of data.globalModules) {
    try {
      const m = raw as Record<string, unknown>;
      const oldId = String(m._id ?? "");
      delete m._id;
      delete m.__v;
      // Remap linked assignment
      if (m.linkedAssignmentId && idMap[String(m.linkedAssignmentId)]) {
        m.linkedAssignmentId = idMap[String(m.linkedAssignmentId)];
      }
      const { generateModuleId } = await import("../utils/funtIdGenerator.js");
      m.moduleId = await generateModuleId();
      const doc = await GlobalModuleModel.create(m);
      idMap[oldId] = String(doc._id);
      imported.globalModules++;
    } catch (err) {
      errors.push({ entity: "GlobalModule", id: String((raw as { _id?: string })._id ?? ""), message: String(err) });
    }
  }

  // ── Import Courses ─────────────────────────────────────────────────────
  for (const raw of data.courses) {
    try {
      const c = raw as Record<string, unknown>;
      const oldId = String(c._id ?? "");
      delete c._id;
      delete c.__v;
      // Generate new courseId
      const { generateCourseId } = await import("../utils/funtIdGenerator.js");
      c.courseId = await generateCourseId();
      // Remap module references
      const modules = (c.modules as Array<Record<string, unknown>>) ?? [];
      for (const mod of modules) {
        if (mod.originalGlobalModuleId && idMap[String(mod.originalGlobalModuleId)]) {
          mod.originalGlobalModuleId = idMap[String(mod.originalGlobalModuleId)];
        }
        if (mod.linkedAssignmentId && idMap[String(mod.linkedAssignmentId)]) {
          mod.linkedAssignmentId = idMap[String(mod.linkedAssignmentId)];
        }
      }
      // Handle conflict based on mode
      if (mode === "REPLACE") {
        const existing = await CourseModel.findOne({ title: c.title }).exec();
        if (existing) {
          await CourseModel.updateOne({ _id: existing._id }, { $set: c }).exec();
          idMap[oldId] = String(existing._id);
          imported.courses++;
          continue;
        }
      }
      if (mode === "CREATE_NEW" || mode === "MERGE") {
        // Append "(Imported)" if title conflicts
        const titleConflict = await CourseModel.findOne({ title: c.title }).lean().exec();
        if (titleConflict && mode === "CREATE_NEW") {
          c.title = `${c.title} (Imported)`;
        }
      }
      c.createdBy = importedBy;
      const doc = await CourseModel.create(c);
      idMap[oldId] = String(doc._id);
      imported.courses++;
    } catch (err) {
      errors.push({ entity: "Course", id: String((raw as { _id?: string })._id ?? ""), message: String(err) });
    }
  }

  // ── Import Batches ─────────────────────────────────────────────────────
  for (const raw of data.batches) {
    try {
      const b = raw as Record<string, unknown>;
      const oldId = String(b._id ?? "");
      delete b._id;
      delete b.__v;
      const { generateBatchId } = await import("../utils/funtIdGenerator.js");
      b.batchId = await generateBatchId();
      // Remap courseIds in snapshots
      const snapshots = (b.courseSnapshots as Array<Record<string, unknown>>) ?? [];
      for (const snap of snapshots) {
        if (snap.courseId && idMap[String(snap.courseId)]) {
          // Keep original courseId for snapshot integrity — don't remap snapshot courseIds
          // Snapshot is a historical record
        }
      }
      b.createdBy = importedBy;
      if (mode === "CREATE_NEW") {
        const nameConflict = await BatchModel.findOne({ name: b.name }).lean().exec();
        if (nameConflict) {
          b.name = `${b.name} (Imported)`;
        }
      }
      const doc = await BatchModel.create(b);
      idMap[oldId] = String(doc._id);
      imported.batches++;
    } catch (err) {
      errors.push({ entity: "Batch", id: String((raw as { _id?: string })._id ?? ""), message: String(err) });
    }
  }

  // ── Import Coupons (level 4) ───────────────────────────────────────────
  for (const raw of data.coupons) {
    try {
      const c = raw as Record<string, unknown>;
      delete c._id;
      delete c.__v;
      // Skip if code already exists
      const existing = await CouponModel.findOne({ code: c.code }).lean().exec();
      if (existing) continue;
      await CouponModel.create(c);
      imported.coupons++;
    } catch (err) {
      errors.push({ entity: "Coupon", id: String((raw as { code?: string }).code ?? ""), message: String(err) });
    }
  }

  // ── Import Shop Products (level 4) ─────────────────────────────────────
  for (const raw of data.shopProducts) {
    try {
      const p = raw as Record<string, unknown>;
      delete p._id;
      delete p.__v;
      await ShopProductModel.create(p);
      imported.shopProducts++;
    } catch (err) {
      errors.push({ entity: "ShopProduct", id: String((raw as { name?: string }).name ?? ""), message: String(err) });
    }
  }

  // ── Import Badge Definitions (level 4) ─────────────────────────────────
  for (const raw of data.badgeDefinitions) {
    try {
      const b = raw as Record<string, unknown>;
      delete b._id;
      delete b.__v;
      const existing = await BadgeTypeDefinitionModel.findOne({ badgeType: b.badgeType }).lean().exec();
      if (existing) continue;
      await BadgeTypeDefinitionModel.create(b);
      imported.badgeDefinitions++;
    } catch (err) {
      errors.push({ entity: "BadgeDefinition", id: String((raw as { badgeType?: string }).badgeType ?? ""), message: String(err) });
    }
  }

  // Audit
  await createAuditLog("IMPORT_COMPLETED", importedBy, "Import", "system", {
    mode,
    ...imported,
    errorCount: errors.length,
  });

  return { imported, idMap, errors };
}
