import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { successRes } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";
import { TICKET_STATUS, TICKET_PRIORITY } from "@funt-platform/constants";
import {
  createTicket,
  replyToTicket,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  resolveTicket,
  closeTicket,
  reopenTicket,
  listTickets,
  getTicketById,
  getTicketAnalytics,
  getSlaDashboard,
} from "../services/ticket.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

function getUserRoles(req: Request): string[] {
  return req.user?.roles ?? [];
}

function getPrimaryRole(req: Request): string {
  const roles = getUserRoles(req);
  const order = ["SUPER_ADMIN", "ADMIN", "TRAINER", "PARENT", "STUDENT"];
  return order.find((r) => roles.includes(r)) ?? (roles[0] ?? "STUDENT");
}

// POST /api/tickets
export const postCreateTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = getPrimaryRole(req);
  const ticket = await createTicket({ ...req.body, createdBy: userId, createdByRole: role });
  successRes(res, ticket, "Ticket created successfully", 201);
});

// GET /api/tickets/my
export const getMyTickets = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const { status, priority, category, search, page, limit } = req.query;
  const result = await listTickets(
    {
      status: typeof status === "string" ? status : undefined,
      priority: typeof priority === "string" ? priority : undefined,
      category: typeof category === "string" ? category : undefined,
      search: typeof search === "string" ? search : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    },
    userId,
    roles
  );
  successRes(res, result);
});

// GET /api/tickets  (admin: all tickets)
export const getAllTickets = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const { createdBy, assignedTo, status, priority, category, search, page, limit } = req.query;
  const result = await listTickets(
    {
      createdBy: typeof createdBy === "string" ? createdBy : undefined,
      assignedTo: typeof assignedTo === "string" ? assignedTo : undefined,
      status: typeof status === "string" ? status : undefined,
      priority: typeof priority === "string" ? priority : undefined,
      category: typeof category === "string" ? category : undefined,
      search: typeof search === "string" ? search : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    },
    userId,
    roles
  );
  successRes(res, result);
});

// GET /api/tickets/analytics
export const getAnalytics = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await getTicketAnalytics();
  successRes(res, data);
});

// GET /api/tickets/sla
export const getSla = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await getSlaDashboard();
  successRes(res, data);
});

// GET /api/tickets/:id
export const getTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const ticket = await getTicketById(req.params.id, userId, roles);
  successRes(res, ticket);
});

// POST /api/tickets/:id/reply
export const postReply = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const { message, attachments, isInternalNote } = req.body;
  const msg = await replyToTicket(req.params.id, userId, roles, message, attachments ?? [], !!isInternalNote);
  successRes(res, msg, "Reply sent", 201);
});

// PATCH /api/tickets/:id/assign
export const patchAssign = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { assignedTo } = req.body;
  if (!assignedTo) throw new AppError("assignedTo is required", 400);
  const ticket = await assignTicket(req.params.id, userId, assignedTo);
  successRes(res, ticket, "Ticket assigned");
});

// PATCH /api/tickets/:id/status
export const patchStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const { status } = req.body;
  if (!status) throw new AppError("status is required", 400);
  const ticket = await updateTicketStatus(req.params.id, userId, roles, status as TICKET_STATUS);
  successRes(res, ticket, "Status updated");
});

// PATCH /api/tickets/:id/priority
export const patchPriority = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { priority } = req.body;
  if (!priority) throw new AppError("priority is required", 400);
  const ticket = await updateTicketPriority(req.params.id, userId, priority as TICKET_PRIORITY);
  successRes(res, ticket, "Priority updated");
});

// PATCH /api/tickets/:id/resolve
export const patchResolve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const { resolution } = req.body;
  if (!resolution?.trim()) throw new AppError("resolution is required", 400);
  const ticket = await resolveTicket(req.params.id, userId, roles, resolution);
  successRes(res, ticket, "Ticket resolved");
});

// PATCH /api/tickets/:id/close
export const patchClose = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const roles = getUserRoles(req);
  const ticket = await closeTicket(req.params.id, userId, roles);
  successRes(res, ticket, "Ticket closed");
});

// PATCH /api/tickets/:id/reopen
export const patchReopen = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const ticket = await reopenTicket(req.params.id, userId);
  successRes(res, ticket, "Ticket reopened");
});
