/**
 * Support Ticket Service
 *
 * Handles ticket lifecycle: create → assign → in_progress → resolved → closed
 * Roles:
 *   STUDENT / PARENT  → create, view own, reply, close
 *   TRAINER           → view assigned, reply, resolve
 *   ADMIN             → view all, assign, change priority/status, escalate, resolve, reopen
 *   SUPER_ADMIN       → full access + configure categories + analytics
 */

import {
  ROLE,
  TICKET_STATUS,
  TICKET_PRIORITY,
  TICKET_CATEGORY_DEFAULT_PRIORITY,
  TICKET_SLA_HOURS,
} from "@funt-platform/constants";
import { TicketModel } from "../models/Ticket.model.js";
import { TicketMessageModel } from "../models/TicketMessage.model.js";
import { CounterModel } from "../models/Counter.model.js";
import { UserModel } from "../models/User.model.js";
import { createAuditLog } from "./audit.service.js";
import { createNotification, createNotifications } from "./notification.service.js";
import { AppError } from "../utils/AppError.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `ticket_${year}`;
  const counter = await CounterModel.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).exec();
  const seq = String(counter!.seq).padStart(6, "0");
  return `TKT-${year}-${seq}`;
}

function computeSlaDueAt(priority: TICKET_PRIORITY): Date {
  const hours = TICKET_SLA_HOURS[priority] ?? 24;
  const due = new Date();
  due.setHours(due.getHours() + hours);
  return due;
}

function defaultPriority(category: string): TICKET_PRIORITY {
  return (TICKET_CATEGORY_DEFAULT_PRIORITY[category] as TICKET_PRIORITY | undefined) ?? TICKET_PRIORITY.MEDIUM;
}

function isStaff(roles: string[]): boolean {
  return roles.some((r) => [ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN, ROLE.SUPPORT_AGENT].includes(r as ROLE));
}

function isAdmin(roles: string[]): boolean {
  return roles.some((r) => [ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(r as ROLE));
}

async function getUserName(userId: string): Promise<string> {
  const u = await UserModel.findById(userId).select("name username").lean().exec();
  return (u as { name?: string } | null)?.name ?? (u as { username?: string } | null)?.username ?? userId;
}

async function getAdminIds(): Promise<string[]> {
  const admins = await UserModel.find({ roles: { $in: [ROLE.ADMIN, ROLE.SUPER_ADMIN] } })
    .select("_id").lean().exec();
  return admins.map((u) => String(u._id));
}

function formatTicket(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    ticketNumber: doc.ticketNumber,
    createdBy: doc.createdBy,
    createdByRole: doc.createdByRole,
    studentId: doc.studentId,
    category: doc.category,
    customCategory: doc.customCategory,
    priority: doc.priority,
    subject: doc.subject,
    description: doc.description,
    attachments: doc.attachments,
    status: doc.status,
    assignedTo: doc.assignedTo,
    assignedToRole: doc.assignedToRole,
    resolvedBy: doc.resolvedBy,
    resolution: doc.resolution,
    resolvedAt: doc.resolvedAt,
    closedAt: doc.closedAt,
    escalatedAt: doc.escalatedAt,
    firstResponseAt: doc.firstResponseAt,
    slaDueAt: doc.slaDueAt,
    slaBreached: doc.slaBreached,
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function enrichTickets(docs: Record<string, unknown>[]) {
  if (!docs.length) return [];
  const userIds = [
    ...new Set(
      docs.flatMap((d) => [
        String(d.createdBy ?? ""),
        String(d.assignedTo ?? ""),
      ]).filter(Boolean)
    ),
  ];
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("_id name username").lean().exec();
  const uMap = new Map(users.map((u) => [
    String(u._id),
    { name: (u as { name?: string }).name ?? "", username: (u as { username?: string }).username ?? "" },
  ]));

  return docs.map((d) => {
    const creator = uMap.get(String(d.createdBy)) ?? { name: "", username: "" };
    const assignee = d.assignedTo ? uMap.get(String(d.assignedTo)) : null;
    return {
      ...formatTicket(d),
      createdByName: creator.name || creator.username || String(d.createdBy),
      createdByUsername: creator.username,
      assignedToName: assignee ? (assignee.name || assignee.username) : undefined,
    };
  });
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateTicketInput {
  createdBy: string;
  createdByRole: string;
  category: string;
  customCategory?: string;
  subject: string;
  description: string;
  priority?: string;
  attachments?: string[];
  studentId?: string;
}

export async function createTicket(input: CreateTicketInput) {
  const priority = (input.priority as TICKET_PRIORITY | undefined) ?? defaultPriority(input.category);
  const ticketNumber = await generateTicketNumber();
  const slaDueAt = computeSlaDueAt(priority);

  const doc = await TicketModel.create({
    ticketNumber,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole,
    studentId: input.studentId || undefined,
    category: input.category,
    customCategory: input.customCategory || undefined,
    priority,
    subject: input.subject,
    description: input.description,
    attachments: input.attachments ?? [],
    status: TICKET_STATUS.OPEN,
    slaDueAt,
  });

  const ticketId = String(doc._id);

  await createAuditLog("TICKET_CREATED", input.createdBy, "Ticket", ticketId, {
    ticketNumber,
    category: input.category,
    priority,
  });

  // Notify creator
  await createNotification({
    userId: input.createdBy,
    title: "Support Ticket Created",
    body: `Your ticket ${ticketNumber} has been submitted. We'll get back to you soon.`,
    type: "GENERAL",
    referenceId: ticketId,
  });

  // Notify all admins
  const adminIds = await getAdminIds();
  const creatorName = await getUserName(input.createdBy);
  await createNotifications(adminIds.map((uid) => ({
    userId: uid,
    title: "New Support Ticket",
    body: `${creatorName} opened ticket ${ticketNumber}: ${input.subject}`,
    type: "GENERAL" as const,
    referenceId: ticketId,
  })));

  return formatTicket(doc.toObject());
}

// ─── Reply ───────────────────────────────────────────────────────────────────

export async function replyToTicket(
  ticketId: string,
  senderId: string,
  senderRoles: string[],
  message: string,
  attachments: string[] = [],
  isInternalNote = false
) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  const isOwner = ticket.createdBy === senderId || ticket.studentId === senderId;
  const staff = isStaff(senderRoles);

  if (!isOwner && !staff) throw new AppError("Forbidden", 403);
  if (isInternalNote && !staff) throw new AppError("Internal notes are staff-only", 403);

  // Students/parents cannot reply to closed/resolved tickets
  if (!staff && [TICKET_STATUS.CLOSED, TICKET_STATUS.RESOLVED].includes(ticket.status as TICKET_STATUS)) {
    throw new AppError("Cannot reply to a closed or resolved ticket", 400);
  }

  const senderRole = senderRoles.includes(ROLE.SUPER_ADMIN)
    ? ROLE.SUPER_ADMIN
    : senderRoles.includes(ROLE.ADMIN)
      ? ROLE.ADMIN
      : senderRoles.includes(ROLE.SUPPORT_AGENT)
        ? ROLE.SUPPORT_AGENT
        : senderRoles.includes(ROLE.TRAINER)
          ? ROLE.TRAINER
          : senderRoles.includes(ROLE.PARENT)
            ? ROLE.PARENT
            : ROLE.STUDENT;

  const msgDoc = await TicketMessageModel.create({
    ticketId,
    senderId,
    senderRole,
    message,
    attachments,
    isInternalNote,
  });

  // Track first staff response for SLA
  if (staff && !ticket.firstResponseAt) {
    ticket.firstResponseAt = new Date();
  }

  // Auto-update status
  if (!isInternalNote) {
    if (staff && ticket.status === TICKET_STATUS.OPEN) {
      ticket.status = TICKET_STATUS.IN_PROGRESS;
    } else if (staff && ticket.status === TICKET_STATUS.WAITING_FOR_SUPPORT) {
      ticket.status = TICKET_STATUS.IN_PROGRESS;
    } else if (!staff && ticket.status === TICKET_STATUS.WAITING_FOR_STUDENT) {
      ticket.status = TICKET_STATUS.WAITING_FOR_SUPPORT;
    }
  }
  await ticket.save();

  await createAuditLog("TICKET_REPLIED", senderId, "Ticket", ticketId, {
    isInternalNote,
    messageId: String(msgDoc._id),
  });

  // Notify the other party (not internal notes)
  if (!isInternalNote) {
    const senderName = await getUserName(senderId);
    if (staff) {
      // Notify ticket owner
      await createNotification({
        userId: ticket.createdBy,
        title: "New Reply on Your Ticket",
        body: `${senderName} replied to your ticket ${ticket.ticketNumber}.`,
        type: "GENERAL",
        referenceId: ticketId,
      });
      if (ticket.studentId && ticket.studentId !== ticket.createdBy) {
        await createNotification({
          userId: ticket.studentId,
          title: "New Reply on Your Ticket",
          body: `${senderName} replied to ticket ${ticket.ticketNumber}.`,
          type: "GENERAL",
          referenceId: ticketId,
        });
      }
    } else {
      // Notify assigned staff or all admins
      const notifyIds = ticket.assignedTo ? [ticket.assignedTo] : await getAdminIds();
      await createNotifications(notifyIds.map((uid) => ({
        userId: uid,
        title: "Student Replied on Ticket",
        body: `${senderName} replied to ticket ${ticket.ticketNumber}.`,
        type: "GENERAL" as const,
        referenceId: ticketId,
      })));
    }
  }

  return {
    id: String(msgDoc._id),
    ticketId: msgDoc.ticketId,
    senderId: msgDoc.senderId,
    senderRole: msgDoc.senderRole,
    message: msgDoc.message,
    attachments: msgDoc.attachments,
    isInternalNote: msgDoc.isInternalNote,
    createdAt: msgDoc.createdAt,
  };
}

// ─── Assign ──────────────────────────────────────────────────────────────────

export async function assignTicket(ticketId: string, adminId: string, assignToId: string) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  const assignee = await UserModel.findById(assignToId).select("_id roles").lean().exec();
  if (!assignee) throw new AppError("Assignee user not found", 404);

  const assigneeRoles = (assignee as { roles: string[] }).roles ?? [];
  const assigneeRole = assigneeRoles.includes(ROLE.SUPER_ADMIN)
    ? ROLE.SUPER_ADMIN
    : assigneeRoles.includes(ROLE.ADMIN)
      ? ROLE.ADMIN
      : ROLE.TRAINER;

  ticket.assignedTo = assignToId;
  ticket.assignedToRole = assigneeRole;
  if (ticket.status === TICKET_STATUS.OPEN) {
    ticket.status = TICKET_STATUS.ASSIGNED;
  }
  await ticket.save();

  await createAuditLog("TICKET_ASSIGNED", adminId, "Ticket", ticketId, { assignToId, assigneeRole });

  const adminName = await getUserName(adminId);
  await createNotification({
    userId: assignToId,
    title: "Ticket Assigned to You",
    body: `${adminName} assigned ticket ${ticket.ticketNumber} to you: ${ticket.subject}`,
    type: "GENERAL",
    referenceId: ticketId,
  });
  await createNotification({
    userId: ticket.createdBy,
    title: "Your Ticket Has Been Assigned",
    body: `Ticket ${ticket.ticketNumber} is now being handled by our team.`,
    type: "GENERAL",
    referenceId: ticketId,
  });

  return formatTicket(ticket.toObject());
}

// ─── Status ──────────────────────────────────────────────────────────────────

export async function updateTicketStatus(
  ticketId: string,
  actorId: string,
  actorRoles: string[],
  newStatus: TICKET_STATUS
) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  const staff = isStaff(actorRoles);
  const admin = isAdmin(actorRoles);

  // TRAINER can only set IN_PROGRESS, WAITING_FOR_STUDENT, RESOLVED
  if (!admin && staff) {
    const trainerAllowed: TICKET_STATUS[] = [
      TICKET_STATUS.IN_PROGRESS,
      TICKET_STATUS.WAITING_FOR_STUDENT,
      TICKET_STATUS.RESOLVED,
      TICKET_STATUS.ESCALATED,  // trainers can escalate to admin/SA attention
    ];
    if (!trainerAllowed.includes(newStatus)) {
      throw new AppError("Trainers can only set IN_PROGRESS, WAITING_FOR_STUDENT, RESOLVED, or ESCALATED", 403);
    }
    // Trainer must be assigned to the ticket to change status
    // (except ESCALATED — any trainer can escalate any ticket to get admin attention)
    if (newStatus !== TICKET_STATUS.ESCALATED && ticket.assignedTo !== actorId) {
      throw new AppError("You can only update status of tickets assigned to you", 403);
    }
  }

  const oldStatus = ticket.status;
  ticket.status = newStatus;

  if (newStatus === TICKET_STATUS.ESCALATED) ticket.escalatedAt = new Date();
  if (newStatus === TICKET_STATUS.CLOSED) ticket.closedAt = new Date();

  await ticket.save();

  await createAuditLog(
    newStatus === TICKET_STATUS.ESCALATED ? "TICKET_ESCALATED" :
    newStatus === TICKET_STATUS.CLOSED ? "TICKET_CLOSED" :
    "TICKET_STATUS_CHANGED",
    actorId, "Ticket", ticketId,
    { oldStatus, newStatus }
  );

  const actorName = await getUserName(actorId);
  await createNotification({
    userId: ticket.createdBy,
    title: "Ticket Status Updated",
    body: `Ticket ${ticket.ticketNumber} status changed to ${newStatus.replace(/_/g, " ")}.`,
    type: "GENERAL",
    referenceId: ticketId,
  });

  if (newStatus === TICKET_STATUS.ESCALATED && ticket.assignedTo) {
    await createNotification({
      userId: ticket.assignedTo,
      title: "Ticket Escalated",
      body: `${actorName} escalated ticket ${ticket.ticketNumber}.`,
      type: "GENERAL",
      referenceId: ticketId,
    });
  }

  return formatTicket(ticket.toObject());
}

// ─── Priority ────────────────────────────────────────────────────────────────

export async function updateTicketPriority(
  ticketId: string,
  adminId: string,
  newPriority: TICKET_PRIORITY
) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  const oldPriority = ticket.priority;
  ticket.priority = newPriority;
  ticket.slaDueAt = computeSlaDueAt(newPriority);
  await ticket.save();

  await createAuditLog("TICKET_PRIORITY_CHANGED", adminId, "Ticket", ticketId, { oldPriority, newPriority });

  return formatTicket(ticket.toObject());
}

// ─── Resolve ─────────────────────────────────────────────────────────────────

export async function resolveTicket(
  ticketId: string,
  actorId: string,
  actorRoles: string[],
  resolution: string
) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  if (!isStaff(actorRoles)) throw new AppError("Only staff can resolve tickets", 403);
  if (!isAdmin(actorRoles) && ticket.assignedTo !== actorId) {
    throw new AppError("Trainers can only resolve their assigned tickets", 403);
  }
  if ([TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED].includes(ticket.status as TICKET_STATUS)) {
    throw new AppError("Ticket is already resolved or closed", 400);
  }

  ticket.status = TICKET_STATUS.RESOLVED;
  ticket.resolvedBy = actorId;
  ticket.resolution = resolution;
  ticket.resolvedAt = new Date();
  await ticket.save();

  await createAuditLog("TICKET_RESOLVED", actorId, "Ticket", ticketId, { resolution });

  const resolverName = await getUserName(actorId);
  await createNotification({
    userId: ticket.createdBy,
    title: "Ticket Resolved",
    body: `Your ticket ${ticket.ticketNumber} has been resolved by ${resolverName}. Resolution: ${resolution.slice(0, 100)}${resolution.length > 100 ? "…" : ""}`,
    type: "GENERAL",
    referenceId: ticketId,
  });

  return formatTicket(ticket.toObject());
}

// ─── Close ───────────────────────────────────────────────────────────────────

export async function closeTicket(ticketId: string, actorId: string, actorRoles: string[]) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  // Students can only close RESOLVED tickets
  const staff = isStaff(actorRoles);
  const isOwner = ticket.createdBy === actorId || ticket.studentId === actorId;

  if (!isOwner && !staff) throw new AppError("Forbidden", 403);
  if (!staff && ticket.status !== TICKET_STATUS.RESOLVED) {
    throw new AppError("You can only close tickets that are resolved", 400);
  }
  if (ticket.status === TICKET_STATUS.CLOSED) throw new AppError("Ticket is already closed", 400);

  ticket.status = TICKET_STATUS.CLOSED;
  ticket.closedAt = new Date();
  await ticket.save();

  await createAuditLog("TICKET_CLOSED", actorId, "Ticket", ticketId, {});

  return formatTicket(ticket.toObject());
}

// ─── Reopen ──────────────────────────────────────────────────────────────────

export async function reopenTicket(ticketId: string, adminId: string) {
  const ticket = await TicketModel.findById(ticketId).exec();
  if (!ticket) throw new AppError("Ticket not found", 404);
  if (![TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED].includes(ticket.status as TICKET_STATUS)) {
    throw new AppError("Only resolved or closed tickets can be reopened", 400);
  }

  ticket.status = TICKET_STATUS.OPEN;
  ticket.resolvedBy = undefined;
  ticket.resolution = undefined;
  ticket.resolvedAt = undefined;
  ticket.closedAt = undefined;
  await ticket.save();

  await createAuditLog("TICKET_REOPENED", adminId, "Ticket", ticketId, {});

  await createNotification({
    userId: ticket.createdBy,
    title: "Ticket Reopened",
    body: `Ticket ${ticket.ticketNumber} has been reopened and is under review.`,
    type: "GENERAL",
    referenceId: ticketId,
  });

  return formatTicket(ticket.toObject());
}

// ─── List / Get ───────────────────────────────────────────────────────────────

export interface ListTicketsFilters {
  createdBy?: string;
  assignedTo?: string;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listTickets(
  filters: ListTicketsFilters,
  viewerId: string,
  viewerRoles: string[]
) {
  const query: Record<string, unknown> = {};
  const andClauses: Record<string, unknown>[] = [];
  const staff = isStaff(viewerRoles);
  const admin = isAdmin(viewerRoles);

  if (!staff) {
    // Students/parents: own tickets only — always enforced
    andClauses.push({ $or: [{ createdBy: viewerId }, { studentId: viewerId }] });
  } else if (!admin) {
    // Trainer: assigned tickets only
    query.assignedTo = viewerId;
  } else {
    // Admin/SA: all, optional filters
    if (filters.createdBy) query.createdBy = filters.createdBy;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  }

  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.category) query.category = filters.category;
  if (filters.search) {
    const searchTerm = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    andClauses.push({
      $or: [
        { subject: { $regex: searchTerm, $options: "i" } },
        { ticketNumber: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    });
  }

  if (andClauses.length === 1) Object.assign(query, andClauses[0]);
  else if (andClauses.length > 1) query.$and = andClauses;

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));

  const [docs, total] = await Promise.all([
    TicketModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
    TicketModel.countDocuments(query).exec(),
  ]);

  const enriched = await enrichTickets(docs as Record<string, unknown>[]);
  return { tickets: enriched, total, page, limit };
}

export async function getTicketById(ticketId: string, viewerId: string, viewerRoles: string[]) {
  const ticket = await TicketModel.findById(ticketId).lean().exec();
  if (!ticket) throw new AppError("Ticket not found", 404);

  const staff = isStaff(viewerRoles);
  const admin = isAdmin(viewerRoles);
  const isOwner = (ticket as { createdBy: string }).createdBy === viewerId ||
                  (ticket as { studentId?: string }).studentId === viewerId;
  const isAssigned = (ticket as { assignedTo?: string }).assignedTo === viewerId;

  if (!isOwner && !admin && !(staff && isAssigned)) {
    throw new AppError("Forbidden", 403);
  }

  // Fetch messages, hide internal notes from non-staff
  const messagesQuery: Record<string, unknown> = { ticketId };
  if (!staff) messagesQuery.isInternalNote = false;
  const messages = await TicketMessageModel.find(messagesQuery).sort({ createdAt: 1 }).lean().exec();

  // Enrich messages with sender names
  const senderIds = [...new Set(messages.map((m) => m.senderId).filter(Boolean))];
  const senderUsers = senderIds.length > 0
    ? await UserModel.find({ _id: { $in: senderIds } }).select("_id name username").lean().exec()
    : [];
  const senderMap = new Map(
    senderUsers.map((u) => [
      String(u._id),
      {
        name: (u as { name?: string }).name ?? "",
        username: (u as { username?: string }).username ?? "",
      },
    ])
  );

  const enriched = await enrichTickets([ticket as Record<string, unknown>]);

  return {
    ...enriched[0],
    messages: messages.map((m) => {
      const sender = senderMap.get(m.senderId) ?? { name: "", username: "" };
      const senderName = sender.name || sender.username || m.senderRole;
      return {
        id: String(m._id),
        ticketId: m.ticketId,
        senderId: m.senderId,
        senderName,
        senderUsername: sender.username,
        senderRole: m.senderRole,
        message: m.message,
        attachments: m.attachments,
        isInternalNote: m.isInternalNote,
        createdAt: m.createdAt,
      };
    }),
  };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getTicketAnalytics() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Use aggregation pipeline instead of loading all documents into memory
  const [facetResult, todayNew, breached, openCount] = await Promise.all([
    TicketModel.aggregate([
      { $match: { createdAt: { $gte: yearStart } } },
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
          byMonth: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          resolution: [
            { $match: { status: TICKET_STATUS.RESOLVED, resolvedAt: { $exists: true } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalMs: { $sum: { $subtract: ["$resolvedAt", "$createdAt"] } },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]).exec(),
    TicketModel.countDocuments({ createdAt: { $gte: todayStart } }).exec(),
    TicketModel.countDocuments({
      status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
      slaDueAt: { $lt: now },
    }).exec(),
    TicketModel.countDocuments({
      status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
    }).exec(),
  ]);

  const facets = facetResult[0] ?? { byStatus: [], byCategory: [], byPriority: [], byMonth: [], resolution: [], total: [] };
  const total = (facets.total as Array<{ count: number }>)[0]?.count ?? 0;
  const resolutionAgg = (facets.resolution as Array<{ count: number; totalMs: number }>)[0];
  const avgResolutionHours = resolutionAgg && resolutionAgg.count > 0
    ? Math.round(resolutionAgg.totalMs / resolutionAgg.count / 3600000 * 10) / 10
    : 0;

  const monthlyTrend = (facets.byMonth as Array<{ _id: string; count: number }>)
    .map((m) => ({ month: m._id, count: m.count }));
  const byStatus = (facets.byStatus as Array<{ _id: string; count: number }>)
    .map((s) => ({ status: s._id, count: s.count }));
  const byCategory = (facets.byCategory as Array<{ _id: string; count: number }>)
    .map((c) => ({ category: c._id, count: c.count }));
  const byPriority = (facets.byPriority as Array<{ _id: string; count: number }>)
    .map((p) => ({ priority: p._id, count: p.count }));

  return {
    summary: {
      total,
      open: openCount,
      openToday: todayNew,
      slaBreaches: breached,
      avgResolutionHours,
    },
    monthlyTrend,
    byStatus,
    byCategory,
    byPriority,
  };
}

// ─── SLA Dashboard ───────────────────────────────────────────────────────────

export async function getSlaDashboard() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [openTotal, breached, dueSoon, avgFirstResponse] = await Promise.all([
    TicketModel.countDocuments({ status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] } }).exec(),
    TicketModel.find({
      status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
      slaDueAt: { $lt: now },
    }).select("ticketNumber subject priority status createdAt slaDueAt").lean().exec(),
    TicketModel.find({
      status: { $nin: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
      slaDueAt: { $gte: now, $lte: new Date(now.getTime() + 3 * 3600000) },
    }).select("ticketNumber subject priority status createdAt slaDueAt").lean().exec(),
    TicketModel.aggregate([
      { $match: { firstResponseAt: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgMs: {
            $avg: { $subtract: ["$firstResponseAt", "$createdAt"] },
          },
        },
      },
    ]).exec(),
  ]);

  const openToday = await TicketModel.countDocuments({ createdAt: { $gte: todayStart } }).exec();

  const avgFirstResponseHours =
    avgFirstResponse.length > 0
      ? Math.round(((avgFirstResponse[0] as { avgMs: number }).avgMs ?? 0) / 3600000 * 10) / 10
      : 0;

  return {
    openTotal,
    openToday,
    slaBreachCount: breached.length,
    dueSoonCount: dueSoon.length,
    avgFirstResponseHours,
    breachedTickets: breached,
    dueSoonTickets: dueSoon,
  };
}
