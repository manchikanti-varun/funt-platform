/**
 * Admin routes – create users, reset login, registration requests (Admin/Super Admin).
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createStudentHandler,
  createTrainerHandler,
  createAdminHandler,
  createParentHandler,
  resetLoginHandler,
} from "../controllers/admin.controller.js";
import {
  submitAdminRequest,
  submitSuperAdminRequest,
  listRequests,
  approveRequest,
  rejectRequest,
} from "../controllers/registrationRequest.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/users/student", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), createStudentHandler);
router.post("/users/trainer", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), createTrainerHandler);
router.post("/users/admin", requireRoles(ROLE.SUPER_ADMIN), createAdminHandler);
router.post("/users/parent", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), createParentHandler);
router.post("/users/:userId/reset-login", requireRoles(ROLE.ADMIN, ROLE.SUPER_ADMIN), resetLoginHandler);

/** Registration requests: list, approve, reject. Super Admin only. */
router.get("/requests", requireRoles(ROLE.SUPER_ADMIN), listRequests);
router.post("/requests/admin", requireRoles(ROLE.SUPER_ADMIN), submitAdminRequest);
router.post("/requests/super-admin", requireRoles(ROLE.SUPER_ADMIN), submitSuperAdminRequest);
router.post("/requests/:requestId/approve", requireRoles(ROLE.SUPER_ADMIN), approveRequest);
router.post("/requests/:requestId/reject", requireRoles(ROLE.SUPER_ADMIN), rejectRequest);

export const adminRoutes = router;
