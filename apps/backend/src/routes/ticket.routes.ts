/**
 * Support Ticket Routes  /api/tickets
 *
 * POST   /api/tickets                  – create (STUDENT, PARENT, TRAINER, ADMIN, SA)
 * GET    /api/tickets/my               – own tickets (all authenticated)
 * GET    /api/tickets/analytics        – analytics (ADMIN, SA)
 * GET    /api/tickets/sla              – SLA dashboard (ADMIN, SA)
 * GET    /api/tickets                  – all tickets (TRAINER, ADMIN, SA)
 * GET    /api/tickets/:id              – single ticket (owner or staff)
 * POST   /api/tickets/:id/reply        – reply (owner or staff)
 * PATCH  /api/tickets/:id/assign       – assign (ADMIN, SA)
 * PATCH  /api/tickets/:id/status       – update status (TRAINER on own, ADMIN, SA)
 * PATCH  /api/tickets/:id/priority     – change priority (ADMIN, SA)
 * PATCH  /api/tickets/:id/resolve      – resolve (TRAINER on own, ADMIN, SA)
 * PATCH  /api/tickets/:id/close        – close (owner when resolved, ADMIN, SA)
 * PATCH  /api/tickets/:id/reopen       – reopen (ADMIN, SA)
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  postCreateTicket,
  getMyTickets,
  getAllTickets,
  getTicket,
  postReply,
  patchAssign,
  patchStatus,
  patchPriority,
  patchResolve,
  patchClose,
  patchReopen,
  getAnalytics,
  getSla,
} from "../controllers/ticket.controller.js";
import { getChatAnalyticsHandler } from "../controllers/chatAnalytics.controller.js";
import {
  createTicketSchema,
  replyTicketSchema,
  assignTicketSchema,
  updateTicketStatusSchema,
  updateTicketPrioritySchema,
  resolveTicketSchema,
} from "../schemas/index.js";

const router = Router();
router.use(authMiddleware);

const ALL_ROLES = [ROLE.STUDENT, ROLE.PARENT, ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUPPORT_AGENT, ROLE.FRANCHISE_ADMIN] as const;
const STAFF_ROLES = [ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUPPORT_AGENT] as const;
const ADMIN_ROLES = [ROLE.ADMIN, ROLE.SUPER_ADMIN] as const;

// ── Fixed routes before /:id ──────────────────────────────────────────────────
router.get("/my",        requireRoles(...ALL_ROLES),   getMyTickets);
router.get("/analytics", requireRoles(...ADMIN_ROLES), getAnalytics);
router.get("/sla",       requireRoles(...ADMIN_ROLES), getSla);
router.get("/chat-analytics", requireRoles(...ADMIN_ROLES), getChatAnalyticsHandler);

// ── Collection ────────────────────────────────────────────────────────────────
router.post("/",  requireRoles(...ALL_ROLES),   validateBody(createTicketSchema), postCreateTicket);
router.get("/",   requireRoles(...STAFF_ROLES), getAllTickets);

// ── Single resource ───────────────────────────────────────────────────────────
router.get("/:id",              requireRoles(...ALL_ROLES),   getTicket);
router.post("/:id/reply",       requireRoles(...ALL_ROLES),   validateBody(replyTicketSchema), postReply);
router.patch("/:id/assign",     requireRoles(...ADMIN_ROLES), validateBody(assignTicketSchema), patchAssign);
router.patch("/:id/status",     requireRoles(...STAFF_ROLES), validateBody(updateTicketStatusSchema), patchStatus);
router.patch("/:id/priority",   requireRoles(...ADMIN_ROLES), validateBody(updateTicketPrioritySchema), patchPriority);
router.patch("/:id/resolve",    requireRoles(...STAFF_ROLES), validateBody(resolveTicketSchema), patchResolve);
router.patch("/:id/close",      requireRoles(...ALL_ROLES),   patchClose);
router.patch("/:id/reopen",     requireRoles(...ADMIN_ROLES), patchReopen);

export const ticketRoutes = router;
