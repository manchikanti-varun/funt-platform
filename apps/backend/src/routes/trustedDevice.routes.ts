/**
 * Trusted Device & Security routes.
 *
 * Student endpoints:
 *   GET  /api/student/devices           — view my trusted devices
 *   POST /api/student/devices/request-change — request a device change
 *
 * Admin endpoints:
 *   GET  /api/admin/device-requests           — list pending device change requests
 *   POST /api/admin/device-requests/:id/approve — approve a request
 *   POST /api/admin/device-requests/:id/reject  — reject a request
 *   GET  /api/admin/security-config           — get security config
 *   PUT  /api/admin/security-config           — update security config (Super Admin)
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { ROLE } from "@funt-platform/constants";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  getStudentDevices,
  createDeviceChangeRequest,
  listDeviceChangeRequests,
  approveDeviceChange,
  rejectDeviceChange,
  getSecurityConfig,
  updateSecurityConfig,
} from "../services/trustedDevice.service.js";

// ─── Student Router ───────────────────────────────────────────────────────────
const studentRouter = Router();
studentRouter.use(authMiddleware);

studentRouter.get("/", requireRoles(ROLE.STUDENT), asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const data = await getStudentDevices(userId);
  successRes(res, data);
}));

studentRouter.post("/request-change", requireRoles(ROLE.STUDENT), asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  const { fingerprint, deviceType, reason } = req.body ?? {};
  if (!fingerprint || !deviceType) throw new AppError("fingerprint and deviceType are required", 400);
  const userAgent = String(req.headers["user-agent"] ?? "");
  const data = await createDeviceChangeRequest(userId, deviceType, fingerprint, userAgent, reason);
  successRes(res, data, data.alreadyPending ? "A request is already pending" : "Device change request submitted");
}));

export const studentDeviceRoutes = studentRouter;

// ─── Admin Router ─────────────────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware);

adminRouter.get("/device-requests", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const data = await listDeviceChangeRequests(status);
  successRes(res, data);
}));

adminRouter.post("/device-requests/:id/approve", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), asyncHandler(async (req, res) => {
  const adminId = req.user?.userId;
  if (!adminId) throw new AppError("Unauthorized", 401);
  const data = await approveDeviceChange(req.params.id, adminId);
  successRes(res, data, "Device change approved");
}));

adminRouter.post("/device-requests/:id/reject", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), asyncHandler(async (req, res) => {
  const adminId = req.user?.userId;
  if (!adminId) throw new AppError("Unauthorized", 401);
  const { note } = req.body ?? {};
  const data = await rejectDeviceChange(req.params.id, adminId, note);
  successRes(res, data, "Device change rejected");
}));

adminRouter.get("/security-config", requireRoles(ROLE.SUPER_ADMIN, ROLE.ADMIN), asyncHandler(async (_req, res) => {
  const data = await getSecurityConfig();
  successRes(res, data);
}));

adminRouter.put("/security-config", requireRoles(ROLE.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const adminId = req.user?.userId;
  if (!adminId) throw new AppError("Unauthorized", 401);
  const data = await updateSecurityConfig(req.body ?? {}, adminId);
  successRes(res, data, "Security config updated");
}));

export const adminSecurityRoutes = adminRouter;
