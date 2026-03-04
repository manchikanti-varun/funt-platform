/**
 * General (event) attendance routes.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createGeneralAttendance,
  listGeneralAttendance,
  getGeneralAttendanceById,
  addPresentToGeneralAttendance,
  getMyGeneralAttendance,
} from "../controllers/generalAttendance.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createGeneralAttendance);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), listGeneralAttendance);
router.get("/me", requireRoles(ROLE.STUDENT), getMyGeneralAttendance);
router.patch("/:id/add-present", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), addPresentToGeneralAttendance);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), getGeneralAttendanceById);

export const generalAttendanceRoutes = router;
