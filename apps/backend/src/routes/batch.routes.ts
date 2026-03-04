
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createBatch,
  listBatches,
  getBatch,
  updateBatch,
  duplicateBatch,
  archiveBatch,
  getBatchStudents,
  addBatchStudent,
  bulkAddBatchStudents,
  removeBatchStudent,
} from "../controllers/batch.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createBatch);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listBatches);
router.get("/:id/students", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getBatchStudents);
router.post("/:id/students", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), addBatchStudent);
router.post("/:id/students/bulk", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkAddBatchStudents);
router.delete("/:id/students/:studentId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), removeBatchStudent);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getBatch);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), updateBatch);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateBatch);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveBatch);

export const batchRoutes = router;
