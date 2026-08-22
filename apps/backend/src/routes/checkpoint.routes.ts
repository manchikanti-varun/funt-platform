/**
 * Checkpoint routes
 *
 * Admin routes (mounted under /api/checkpoints):
 *   GET    /module/:moduleId              — list checkpoints
 *   POST   /module/:moduleId              — create checkpoint
 *   POST   /module/:moduleId/bulk-import  — bulk import from JSON
 *   POST   /module/:moduleId/duplicate    — duplicate from another module
 *   GET    /module/:moduleId/export       — export as JSON
 *   PUT    /:checkpointId                 — update checkpoint
 *   DELETE /:checkpointId                 — delete checkpoint
 *
 * Student routes (mounted under /api/student/checkpoints):
 *   GET    /                              — get checkpoints (query: moduleId)
 *   GET    /progress                      — get progress (query: moduleId)
 *   POST   /:checkpointId/answer          — submit answer
 *   POST   /position                      — save video position
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  bulkImportCheckpoints,
  duplicateCheckpoints,
  exportCheckpoints,
  getStudentCheckpoints,
  getStudentProgress,
  submitAnswer,
  savePosition,
} from "../controllers/checkpoint.controller.js";
import {
  createCheckpointSchema,
  updateCheckpointSchema,
  submitCheckpointAnswerSchema,
  savePositionSchema,
  bulkImportCheckpointsSchema,
  duplicateCheckpointsSchema,
} from "../schemas/checkpoint.schema.js";

// ─── Admin routes ─────────────────────────────────────────────────────────────

export const checkpointAdminRoutes = Router();
checkpointAdminRoutes.use(authMiddleware, requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN));

checkpointAdminRoutes.get("/module/:moduleId", listCheckpoints);
checkpointAdminRoutes.post("/module/:moduleId", validateBody(createCheckpointSchema), createCheckpoint);
checkpointAdminRoutes.post("/module/:moduleId/bulk-import", validateBody(bulkImportCheckpointsSchema), bulkImportCheckpoints);
checkpointAdminRoutes.post("/module/:moduleId/duplicate", validateBody(duplicateCheckpointsSchema), duplicateCheckpoints);
checkpointAdminRoutes.get("/module/:moduleId/export", exportCheckpoints);
checkpointAdminRoutes.put("/:checkpointId", validateBody(updateCheckpointSchema), updateCheckpoint);
checkpointAdminRoutes.delete("/:checkpointId", deleteCheckpoint);

// ─── Student routes ───────────────────────────────────────────────────────────

export const checkpointStudentRoutes = Router();
checkpointStudentRoutes.use(authMiddleware, requireRoles(ROLE.STUDENT));

checkpointStudentRoutes.get("/", getStudentCheckpoints);
checkpointStudentRoutes.get("/progress", getStudentProgress);
checkpointStudentRoutes.post("/:checkpointId/answer", validateBody(submitCheckpointAnswerSchema), submitAnswer);
checkpointStudentRoutes.post("/position", validateBody(savePositionSchema), savePosition);
