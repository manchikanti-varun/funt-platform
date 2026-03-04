/**
 * Global Assignment routes – RESTful CRUD + archive. Protected: SUPER_ADMIN, ADMIN only.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  archiveAssignment,
  duplicateAssignment,
  getSubmissionsForAssignment,
  reviewGlobalSubmission,
  bulkReviewGlobalSubmissions,
  listAssignmentAccess,
  addAssignmentAccess,
  removeAssignmentAccess,
  bulkAddAssignmentAccess,
} from "../controllers/globalAssignment.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), createAssignment);
router.get("/", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), listAssignments);
router.post("/submissions/bulk-review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkReviewGlobalSubmissions);
router.patch("/submissions/:subId/review", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), reviewGlobalSubmission);
router.get("/:id/submissions", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), getSubmissionsForAssignment);
router.get("/:id/access", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), listAssignmentAccess);
router.post("/:id/access", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), addAssignmentAccess);
router.post("/:id/access/bulk", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), bulkAddAssignmentAccess);
router.delete("/:id/access/:studentId", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), removeAssignmentAccess);
router.get("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER), getAssignment);
router.put("/:id", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), updateAssignment);
router.patch("/:id/archive", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), archiveAssignment);
router.post("/:id/duplicate", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), duplicateAssignment);

export const globalAssignmentRoutes = router;
