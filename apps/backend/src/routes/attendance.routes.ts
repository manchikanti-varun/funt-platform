/**
 * Attendance routes – mark (admin/trainer), list by batch, my (student).
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  markAttendance,
  markBatchAttendanceByFuntIds,
  addPresentToBatchSession,
  getAttendanceForBatch,
  getAttendanceByStudentsForBatch,
  getMyAttendance,
} from "../controllers/attendance.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), markAttendance);
router.post("/batch/:batchId/mark-by-ids", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), markBatchAttendanceByFuntIds);
router.post("/batch/:batchId/add-present", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), addPresentToBatchSession);
router.get("/batch/:batchId/students", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getAttendanceByStudentsForBatch);
router.get("/batch/:batchId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getAttendanceForBatch);
router.get("/me", requireRoles(ROLE.STUDENT), getMyAttendance);

export const attendanceRoutes = router;
