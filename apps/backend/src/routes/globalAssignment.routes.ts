import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { createGlobalAssignmentSchema, updateGlobalAssignmentSchema, reviewGlobalSubmissionSchema } from "../schemas/index.js";
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  archiveAssignment,
  unarchiveAssignment,
  deleteAssignment,
  duplicateAssignment,
  getSubmissionsForAssignment,
  reviewGlobalSubmission,
  bulkReviewGlobalSubmissions,
  listAssignmentAccess,
  addAssignmentAccess,
  removeAssignmentAccess,
  bulkAddAssignmentAccess,
  bulkRemoveAssignmentAccess,
} from "../controllers/globalAssignment.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(createGlobalAssignmentSchema), createAssignment);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listAssignments);
router.post("/submissions/bulk-review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkReviewGlobalSubmissions);
router.patch("/submissions/:subId/review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(reviewGlobalSubmissionSchema), reviewGlobalSubmission);
router.get("/:id/submissions", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), getSubmissionsForAssignment);
router.get("/:id/access", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), listAssignmentAccess);
router.post("/:id/access", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), addAssignmentAccess);
router.post("/:id/access/bulk", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkAddAssignmentAccess);
router.post("/:id/access/bulk-remove", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkRemoveAssignmentAccess);
router.delete("/:id/access/:studentId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), removeAssignmentAccess);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getAssignment);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), validateBody(updateGlobalAssignmentSchema), updateAssignment);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveAssignment);
router.patch("/:id/unarchive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), unarchiveAssignment);
router.delete("/:id", requireRoles(ROLE.SUPER_ADMIN), deleteAssignment);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateAssignment);

export const globalAssignmentRoutes = router;
