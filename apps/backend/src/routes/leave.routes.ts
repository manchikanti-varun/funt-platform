/**
 * Leave Management Routes
 *
 * POST   /api/leaves                  – submit a leave request
 * GET    /api/leaves/my               – get own leaves
 * GET    /api/leaves/my/balance       – get own leave balance
 * GET    /api/leaves/calendar         – monthly calendar (admin+)
 * GET    /api/leaves/analytics        – analytics (admin+)
 * GET    /api/leaves/policy           – get leave policy
 * PUT    /api/leaves/policy           – upsert leave policy (super admin only)
 * GET    /api/leaves                  – list all leaves (admin+)
 * GET    /api/leaves/:id              – get single leave
 * PATCH  /api/leaves/:id/approve      – approve (admin+)
 * PATCH  /api/leaves/:id/reject       – reject (admin+)
 * PATCH  /api/leaves/:id/cancel       – cancel own leave
 * PATCH  /api/leaves/:id/substitute   – assign substitute trainer (admin+)
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  postCreateLeave,
  getMyLeaves,
  getMyBalance,
  getAllLeaves,
  getLeave,
  patchApproveLeave,
  patchRejectLeave,
  patchCancelLeave,
  getCalendar,
  getAnalytics,
  getLeavePolicyConfig,
  putLeavePolicy,
  patchSubstituteTrainer,
} from "../controllers/leave.controller.js";
import { createLeaveSchema, leavePolicySchema } from "../schemas/index.js";

const router = Router();
router.use(authMiddleware);

const STAFF_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER] as const;
const ADMIN_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN] as const;
const SUPER_ADMIN_ONLY = [ROLE.SUPER_ADMIN] as const;

// ── Fixed-path routes first (before /:id) ───────────────────────────────────
router.get("/my/balance", requireRoles(...STAFF_ROLES), getMyBalance);
router.get("/my", requireRoles(...STAFF_ROLES), getMyLeaves);
router.get("/calendar", requireRoles(...ADMIN_ROLES), getCalendar);
router.get("/analytics", requireRoles(...ADMIN_ROLES), getAnalytics);
router.get("/policy", requireRoles(...STAFF_ROLES), getLeavePolicyConfig);
router.put("/policy", requireRoles(...SUPER_ADMIN_ONLY), validateBody(leavePolicySchema), putLeavePolicy);

// ── Staff create + admin list ────────────────────────────────────────────────
router.post("/", requireRoles(...STAFF_ROLES), validateBody(createLeaveSchema), postCreateLeave);
router.get("/", requireRoles(...ADMIN_ROLES), getAllLeaves);

// ── Single resource operations ───────────────────────────────────────────────
router.get("/:id", requireRoles(...STAFF_ROLES), getLeave);
router.patch("/:id/approve", requireRoles(...ADMIN_ROLES), patchApproveLeave);
router.patch("/:id/reject", requireRoles(...ADMIN_ROLES), patchRejectLeave);
router.patch("/:id/cancel", requireRoles(...STAFF_ROLES), patchCancelLeave);
router.patch("/:id/substitute", requireRoles(...ADMIN_ROLES), patchSubstituteTrainer);

export const leaveRoutes = router;
