import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import {
  requestPaymentPromise,
  approvePaymentPromise,
  rejectPaymentPromise,
  markPromisePaid,
  cancelPaymentPromise,
  changeDueDate,
  reactivatePromise,
  getStudentPromises,
  getAdminPromises,
  getOverduePromises,
  getPromiseAnalytics,
  processOverduePromises,
  sendPromiseReminders,
} from "../services/paymentPromise.service.js";

function uid(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

// ── Student/Parent: Request a promise ─────────────────────────────────────────

// POST /api/payment-promises/request
export const postRequestPromise = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const { batchId, courseId, milestoneId, promiseDate, reason } = req.body ?? {};
  if (!batchId || !courseId || !milestoneId || !promiseDate) {
    throw new AppError("batchId, courseId, milestoneId, and promiseDate are required", 400);
  }
  const result = await requestPaymentPromise({ studentId, batchId, courseId, milestoneId, promiseDate, reason });
  successRes(res, result, "Payment promise request submitted", 201);
});

// ── Student: Get own promises ─────────────────────────────────────────────────

// GET /api/payment-promises/student
export const getMyPromises = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = uid(req);
  const data = await getStudentPromises(studentId);
  successRes(res, data);
});

// ── Admin: Approve ────────────────────────────────────────────────────────────

// POST /api/payment-promises/:id/approve
export const postApprove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const promiseId = req.params.id;
  const { adminDueDate, remarks } = req.body ?? {};
  const result = await approvePaymentPromise({ promiseId, adminId, adminDueDate, remarks });
  successRes(res, result, "Payment promise approved");
});

// ── Admin: Reject ─────────────────────────────────────────────────────────────

// POST /api/payment-promises/:id/reject
export const postReject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const promiseId = req.params.id;
  const { rejectionNote } = req.body ?? {};
  const result = await rejectPaymentPromise({ promiseId, adminId, rejectionNote });
  successRes(res, result, "Payment promise rejected");
});

// ── Admin/System: Mark as paid ────────────────────────────────────────────────

// POST /api/payment-promises/:id/pay
export const postMarkPaid = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const promiseId = req.params.id;
  const { paymentId } = req.body ?? {};
  if (!paymentId) throw new AppError("paymentId is required", 400);
  const result = await markPromisePaid(promiseId, paymentId, actorId);
  successRes(res, result, "Payment promise marked as paid");
});

// ── Admin: Cancel ─────────────────────────────────────────────────────────────

// DELETE /api/payment-promises/:id
export const deletePromise = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const actorId = uid(req);
  const promiseId = req.params.id;
  const result = await cancelPaymentPromise(promiseId, actorId);
  successRes(res, result, "Payment promise cancelled");
});

// ── Admin: Change due date ────────────────────────────────────────────────────

// PATCH /api/payment-promises/:id/due-date
export const patchDueDate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const promiseId = req.params.id;
  const { newDueDate } = req.body ?? {};
  if (!newDueDate) throw new AppError("newDueDate is required", 400);
  const result = await changeDueDate(promiseId, newDueDate, adminId);
  successRes(res, result, "Due date updated");
});

// ── Admin: Reactivate ─────────────────────────────────────────────────────────

// POST /api/payment-promises/:id/reactivate
export const postReactivate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = uid(req);
  const promiseId = req.params.id;
  const result = await reactivatePromise(promiseId, adminId);
  successRes(res, result, "Access reactivated");
});

// ── Admin: List all / filtered ────────────────────────────────────────────────

// GET /api/payment-promises/admin
export const getAdminList = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { status, studentId, batchId, courseId, page, limit } = req.query;
  const data = await getAdminPromises({
    status: status as string | undefined,
    studentId: studentId as string | undefined,
    batchId: batchId as string | undefined,
    courseId: courseId as string | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  successRes(res, data);
});

// ── Admin: Overdue list ───────────────────────────────────────────────────────

// GET /api/payment-promises/overdue
export const getOverdueList = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await getOverduePromises();
  successRes(res, data);
});

// ── Admin: Analytics ──────────────────────────────────────────────────────────

// GET /api/payment-promises/analytics
export const getAnalytics = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await getPromiseAnalytics();
  successRes(res, data);
});

// ── Admin: Process overdue (cron/manual trigger) ──────────────────────────────

// POST /api/payment-promises/process-overdue
export const postProcessOverdue = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const result = await processOverduePromises();
  successRes(res, result, `${result.flagged} promise(s) flagged as overdue`);
});

// ── Admin: Send reminders (cron/manual trigger) ───────────────────────────────

// POST /api/payment-promises/send-reminders
export const postSendReminders = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const result = await sendPromiseReminders();
  successRes(res, result, `${result.sent} reminder(s) sent`);
});
