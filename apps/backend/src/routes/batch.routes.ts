
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { requireBatchOwnership } from "../middleware/trainerOwnership.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { createBatchSchema, updateBatchSchema } from "../schemas/index.js";
import {
  createBatch,
  listBatches,
  getBatch,
  updateBatch,
  duplicateBatch,
  syncCourseContent,
  archiveBatch,
  unarchiveBatch,
  deleteBatch,
  getBatchStudents,
  addBatchStudent,
  bulkAddBatchStudents,
  bulkRemoveBatchStudents,
  removeBatchStudent,
  transferBatchStudent,
  setGlobalOnlineBatchHandler,
  setNotEnrolledBatchHandler,
} from "../controllers/batch.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(createBatchSchema), createBatch);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listBatches);
router.get("/:id/students", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getBatchStudents);
router.post("/:id/students", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), addBatchStudent);
router.post("/:id/students/bulk", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkAddBatchStudents);
router.post("/:id/students/bulk-remove", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkRemoveBatchStudents);
router.delete("/:id/students/:studentId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), removeBatchStudent);
router.post("/:id/students/transfer", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), transferBatchStudent);
router.post("/:id/set-global-online", requireRoles(ROLE.SUPER_ADMIN), setGlobalOnlineBatchHandler);
router.post("/:id/set-not-enrolled", requireRoles(ROLE.SUPER_ADMIN), setNotEnrolledBatchHandler);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getBatch);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), requireBatchOwnership, validateBody(updateBatchSchema), updateBatch);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateBatch);
router.post("/:id/sync-course", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), syncCourseContent);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveBatch);
router.patch("/:id/unarchive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), unarchiveBatch);
router.delete("/:id", requireRoles(ROLE.SUPER_ADMIN), deleteBatch);

export const batchRoutes = router;
