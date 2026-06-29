/**
 * Payment Promise Routes
 *
 * Student/Parent:
 *   POST   /api/payment-promises/request          — request a pay-later promise
 *   GET    /api/payment-promises/student           — list own promises
 *
 * Admin:
 *   GET    /api/payment-promises/admin             — list all (filterable)
 *   GET    /api/payment-promises/overdue           — list overdue promises
 *   GET    /api/payment-promises/analytics         — analytics summary
 *   POST   /api/payment-promises/:id/approve       — approve a promise
 *   POST   /api/payment-promises/:id/reject        — reject a promise
 *   POST   /api/payment-promises/:id/pay           — mark as paid
 *   POST   /api/payment-promises/:id/reactivate    — restore access
 *   PATCH  /api/payment-promises/:id/due-date      — change due date
 *   DELETE /api/payment-promises/:id               — cancel a promise
 *   POST   /api/payment-promises/process-overdue   — suspend overdue
 *   POST   /api/payment-promises/send-reminders    — trigger reminders
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  postRequestPromise,
  getMyPromises,
  postApprove,
  postReject,
  postMarkPaid,
  deletePromise,
  patchDueDate,
  postReactivate,
  getAdminList,
  getOverdueList,
  getAnalytics,
  postProcessOverdue,
  postSendReminders,
} from "../controllers/paymentPromise.controller.js";

const ADMIN_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN] as const;
const STUDENT_ROLES = [ROLE.STUDENT, ROLE.PARENT] as const;

export const paymentPromiseRoutes = Router();
paymentPromiseRoutes.use(authMiddleware);

// ── Student/Parent endpoints ──────────────────────────────────────────────────
paymentPromiseRoutes.post("/request",  requireRoles(...STUDENT_ROLES), postRequestPromise);
paymentPromiseRoutes.get("/student",   requireRoles(...STUDENT_ROLES), getMyPromises);

// ── Admin endpoints ───────────────────────────────────────────────────────────
paymentPromiseRoutes.get("/admin",        requireRoles(...ADMIN_ROLES), getAdminList);
paymentPromiseRoutes.get("/overdue",      requireRoles(...ADMIN_ROLES), getOverdueList);
paymentPromiseRoutes.get("/analytics",    requireRoles(...ADMIN_ROLES), getAnalytics);

paymentPromiseRoutes.post("/:id/approve",     requireRoles(...ADMIN_ROLES), postApprove);
paymentPromiseRoutes.post("/:id/reject",      requireRoles(...ADMIN_ROLES), postReject);
paymentPromiseRoutes.post("/:id/pay",         requireRoles(...ADMIN_ROLES), postMarkPaid);
paymentPromiseRoutes.post("/:id/reactivate",  requireRoles(...ADMIN_ROLES), postReactivate);
paymentPromiseRoutes.patch("/:id/due-date",   requireRoles(...ADMIN_ROLES), patchDueDate);
paymentPromiseRoutes.delete("/:id",           requireRoles(...ADMIN_ROLES), deletePromise);

// ── Cron/Manual triggers ──────────────────────────────────────────────────────
paymentPromiseRoutes.post("/process-overdue",  requireRoles(...ADMIN_ROLES), postProcessOverdue);
paymentPromiseRoutes.post("/send-reminders",   requireRoles(...ADMIN_ROLES), postSendReminders);
