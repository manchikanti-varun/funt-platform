
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { createEnrollmentSchema, bulkEnrollSchema } from "../schemas/index.js";
import {
  createEnrollment,
  getMyEnrollments,
  getEnrollmentRequestsForAdmin,
  respondToEnrollmentRequest,
  postBulkEnrollment,
} from "../controllers/enrollment.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN), validateBody(createEnrollmentSchema), createEnrollment);
router.post("/bulk", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN), validateBody(bulkEnrollSchema), postBulkEnrollment);
router.get("/me", requireRoles(ROLE.STUDENT), getMyEnrollments);
router.get("/requests", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN), getEnrollmentRequestsForAdmin);
router.post("/requests/:id/respond", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.SUB_ADMIN), respondToEnrollmentRequest);

export const enrollmentRoutes = router;
