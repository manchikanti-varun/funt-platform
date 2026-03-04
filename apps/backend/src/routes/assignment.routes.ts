
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  submitAssignment,
  reviewSubmission,
  bulkReviewSubmissions,
  listSubmissions,
} from "../controllers/assignmentSubmission.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/submit", requireRoles(ROLE.STUDENT), submitAssignment);
router.get("/submissions", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listSubmissions);
router.post("/bulk-review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), bulkReviewSubmissions);
router.patch("/:id/review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), reviewSubmission);

export const assignmentRoutes = router;
