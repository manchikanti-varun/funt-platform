import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import { ROLE } from "@funt-platform/constants";
import {
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveById,
  listLeaves,
  getLeaveCalendar,
  getLeaveAnalytics,
  getMyLeaveBalance,
  upsertLeavePolicy,
  getLeavePolicy,
  assignSubstituteTrainer,
} from "../services/leave.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function getUserRoles(req: Request): string[] {
  return req.user?.roles ?? [];
}

function getPrimaryRole(req: Request): string {
  const roles = getUserRoles(req);
  if (roles.includes(ROLE.SUPER_ADMIN)) return ROLE.SUPER_ADMIN;
  if (roles.includes(ROLE.ADMIN)) return ROLE.ADMIN;
  if (roles.includes(ROLE.TRAINER)) return ROLE.TRAINER;
  return roles[0] ?? ROLE.TRAINER;
}

// POST /api/leaves
export const postCreateLeave = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = getPrimaryRole(req);

  const leave = await createLeaveRequest({
    requestedBy: userId,
    requestedByRole: role,
    ...req.body,
  });

  successRes(res, leave, "Leave request submitted successfully", 201);
});

// GET /api/leaves/my
export const getMyLeaves = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { status, leaveType, fromDate, toDate, page, limit } = req.query;

  const result = await listLeaves(
    {
      requestedBy: userId,
      status: typeof status === "string" ? status : undefined,
      leaveType: typeof leaveType === "string" ? leaveType : undefined,
      fromDate: typeof fromDate === "string" ? fromDate : undefined,
      toDate: typeof toDate === "string" ? toDate : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    },
    [ROLE.TRAINER]   // treat as non-admin so only own leaves are returned
  );

  successRes(res, result);
});

// GET /api/leaves/my/balance
export const getMyBalance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const balance = await getMyLeaveBalance(userId);
  successRes(res, balance);
});

// GET /api/leaves  (admin/super-admin: all leaves)
export const getAllLeaves = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const roles = getUserRoles(req);
  const { requestedBy, status, role, leaveType, fromDate, toDate, page, limit } = req.query;

  const result = await listLeaves(
    {
      requestedBy: typeof requestedBy === "string" ? requestedBy : undefined,
      status: typeof status === "string" ? status : undefined,
      role: typeof role === "string" ? role : undefined,
      leaveType: typeof leaveType === "string" ? leaveType : undefined,
      fromDate: typeof fromDate === "string" ? fromDate : undefined,
      toDate: typeof toDate === "string" ? toDate : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    },
    roles
  );

  successRes(res, result);
});

// GET /api/leaves/:id
export const getLeave = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const leave = await getLeaveById(req.params.id, userId, roles);
  successRes(res, leave);
});

// PATCH /api/leaves/:id/approve
export const patchApproveLeave = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = getPrimaryRole(req);
  const { reviewRemarks } = req.body;
  const leave = await approveLeaveRequest(req.params.id, userId, role, reviewRemarks);
  successRes(res, leave, "Leave request approved");
});

// PATCH /api/leaves/:id/reject
export const patchRejectLeave = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = getPrimaryRole(req);
  const { reviewRemarks } = req.body;
  if (!reviewRemarks?.trim()) throw new AppError("Review remarks are required when rejecting a leave", 400);
  const leave = await rejectLeaveRequest(req.params.id, userId, role, reviewRemarks);
  successRes(res, leave, "Leave request rejected");
});

// PATCH /api/leaves/:id/cancel
export const patchCancelLeave = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = getPrimaryRole(req);
  const leave = await cancelLeaveRequest(req.params.id, userId, role);
  successRes(res, leave, "Leave request cancelled");
});

// GET /api/leaves/calendar?year=2025&month=6
export const getCalendar = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const roles = getUserRoles(req);
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
  const leaves = await getLeaveCalendar(year, month, roles);
  successRes(res, leaves);
});

// GET /api/leaves/analytics
export const getAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const roles = getUserRoles(req);
  const data = await getLeaveAnalytics(roles);
  successRes(res, data);
});

// GET /api/leaves/policy?year=2025
export const getLeavePolicyConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const policy = await getLeavePolicy(year);
  successRes(res, policy);
});

// PUT /api/leaves/policy
export const putLeavePolicy = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { year, annualLeaveLimit, leaveTypes, allowHalfDay, maxConsecutiveLeaves, customLeaveTypes } = req.body;
  const policy = await upsertLeavePolicy(
    year ?? 0,
    { annualLeaveLimit, leaveTypes, allowHalfDay, maxConsecutiveLeaves, customLeaveTypes },
    userId
  );
  successRes(res, policy, "Leave policy updated");
});

// PATCH /api/leaves/:id/substitute
export const patchSubstituteTrainer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { substituteTrainerId, leaveImpactNotes } = req.body;
  const leave = await assignSubstituteTrainer(req.params.id, userId, substituteTrainerId ?? null, leaveImpactNotes);
  successRes(res, leave, "Substitute trainer assigned");
});
