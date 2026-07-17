import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { submitAssignmentBodySchema, reviewGlobalSubmissionSchema } from "../schemas/index.js";
import {
  submitAssignment,
  reviewSubmission,
  bulkReviewSubmissions,
  listSubmissions,
} from "../controllers/assignmentSubmission.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/submit", requireRoles(ROLE.STUDENT), validateBody(submitAssignmentBodySchema), submitAssignment);
router.get("/submissions", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listSubmissions);
router.post("/bulk-review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), bulkReviewSubmissions);
router.patch("/:id/review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), validateBody(reviewGlobalSubmissionSchema), reviewSubmission);

export const assignmentRoutes = router;
