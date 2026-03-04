
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createEnrollment,
  getMyEnrollments,
  getEnrollmentRequestsForAdmin,
  respondToEnrollmentRequest,
  postBulkEnrollment,
} from "../controllers/enrollment.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createEnrollment);
router.post("/bulk", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), postBulkEnrollment);
router.get("/me", requireRoles(ROLE.STUDENT), getMyEnrollments);
router.get("/requests", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), getEnrollmentRequestsForAdmin);
router.post("/requests/:id/respond", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), respondToEnrollmentRequest);

export const enrollmentRoutes = router;
