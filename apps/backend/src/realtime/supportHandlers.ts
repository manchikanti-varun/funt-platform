/**
 * Support Chat Handlers — real-time event handling for live support.
 *
 * Features:
 *   - Student request → agent accept → live chat → close
 *   - No-agent timeout (60s) → fallback to async ticket
 *   - Auto-close after 30 min inactivity
 *   - Transfer chat to another agent
 *   - Chat rating (1-5 stars)
 *   - Agent online/offline toggle
 *   - Online agents count broadcast
 */

import type { Server, Socket } from "socket.io";
import { TicketModel } from "../models/Ticket.model.js";
import { TicketMessageModel } from "../models/TicketMessage.model.js";
import { TICKET_STATUS, TICKET_CATEGORY, TICKET_PRIORITY } from "@funt-platform/constants";
import { generateTicketNumber } from "../services/ticket.service.js";

// ── Auto-close timers (ticketId → timeout handle) ───────────────────────────
const autoCloseTimers = new Map<string, NodeJS.Timeout>();
const AUTO_CLOSE_MS = 30 * 60 * 1000; // 30 minutes

// ── No-agent timeout (ticketId → timeout handle) ────────────────────────────
const noAgentTimers = new Map<string, NodeJS.Timeout>();
const NO_AGENT_TIMEOUT_MS = 60 * 1000; // 60 seconds

function resetAutoCloseTimer(io: Server, ticketId: string) {
  const existing = autoCloseTimers.get(ticketId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    autoCloseTimers.delete(ticketId);
    try {
      const ticket = await TicketModel.findOneAndUpdate(
        { _id: ticketId, liveChatStatus: "ACTIVE" },
        {
          $set: {
            status: TICKET_STATUS.RESOLVED,
            liveChatStatus: "CLOSED",
            resolution: "Auto-closed due to 30 minutes of inactivity.",
            resolvedAt: new Date(),
          },
        },
        { new: true }
      ).exec();
      if (ticket) {
        io.to(`ticket:${ticketId}`).emit("support:closed", {
          ticketId,
          closedBy: "System",
          reason: "auto-close",
        });
      }
    } catch (err) {
      console.error("[live-chat] Auto-close error:", err);
    }
  }, AUTO_CLOSE_MS);

  autoCloseTimers.set(ticketId, timer);
}

function clearAutoCloseTimer(ticketId: string) {
  const t = autoCloseTimers.get(ticketId);
  if (t) { clearTimeout(t); autoCloseTimers.delete(ticketId); }
}

function clearNoAgentTimer(ticketId: string) {
  const t = noAgentTimers.get(ticketId);
  if (t) { clearTimeout(t); noAgentTimers.delete(ticketId); }
}

async function getOnlineAgentCount(io: Server): Promise<number> {
  const room = io.sockets.adapter.rooms.get("agents");
  return room ? room.size : 0;
}

export function registerSupportHandlers(io: Server, socket: Socket): void {
  const { userId, username, name, roles, isStaff } = socket.data;

  // ── Student: Request live support ─────────────────────────────────
  let lastSupportRequestAt = 0;
  const SUPPORT_REQUEST_COOLDOWN_MS = 30_000; // 30 seconds between requests

  socket.on("support:request", async (data: { message?: string }) => {
    if (isStaff) return;

    // Rate limit: max 1 support request per 30 seconds per student
    const now = Date.now();
    if (now - lastSupportRequestAt < SUPPORT_REQUEST_COOLDOWN_MS) {
      socket.emit("support:error", { error: "Please wait before creating another support request" });
      return;
    }
    lastSupportRequestAt = now;

    const message = data.message?.trim();
    if (!message) {
      socket.emit("support:error", { error: "Message is required" });
      return;
    }

    if (message.length > 2000) {
      socket.emit("support:error", { error: "Message too long (max 2000 characters)" });
      return;
    }

    try {
      const ticketNumber = await generateTicketNumber();
      const ticket = await TicketModel.create({
        ticketNumber,
        createdBy: userId,
        createdByRole: roles.includes("STUDENT") ? "STUDENT" : roles[0],
        category: TICKET_CATEGORY.GENERAL_QUERY,
        priority: TICKET_PRIORITY.MEDIUM,
        subject: message.slice(0, 100),
        description: message,
        status: TICKET_STATUS.OPEN,
        isLiveChat: true,
        liveChatStatus: "WAITING",
      });

      await TicketMessageModel.create({
        ticketId: String(ticket._id),
        senderId: userId,
        senderRole: roles.includes("STUDENT") ? "STUDENT" : roles[0],
        message,
      });

      const ticketId = String(ticket._id);
      socket.join(`ticket:${ticketId}`);

      // Check if any agents are online
      const agentCount = await getOnlineAgentCount(io);

      socket.emit("support:waiting", {
        ticketId,
        ticketNumber,
        message: "Please wait while we assign a support agent.",
        agentsOnline: agentCount,
      });

      // Broadcast to online agents
      io.to("agents").emit("support:incoming", {
        ticketId,
        ticketNumber,
        studentName: name,
        studentUsername: username,
        message,
        createdAt: new Date().toISOString(),
      });

      // Start no-agent timeout — if no one accepts in 60s, notify student
      const timer = setTimeout(async () => {
        noAgentTimers.delete(ticketId);
        // Check if still waiting
        const t = await TicketModel.findById(ticketId).lean().exec();
        if (t && (t as { liveChatStatus?: string }).liveChatStatus === "WAITING") {
          // Try AI auto-reply first
          try {
            const { getAiResponse } = await import("../services/aiSupport.service.js");
            const { reply, confident } = await getAiResponse(message);

            // Save AI reply as a ticket message
            await TicketMessageModel.create({
              ticketId,
              senderId: "AI_BOT",
              senderRole: "ADMIN",
              message: reply,
            });

            // Send AI response to student
            socket.emit("support:ai-reply", {
              ticketId,
              ticketNumber,
              text: reply,
              confident,
            });

            // If AI is not confident, also show the no-agents fallback
            if (!confident) {
              socket.emit("support:no-agents", {
                ticketId,
                ticketNumber,
                message: "Your question has been saved. A support agent will follow up when available.",
              });
            }
          } catch {
            socket.emit("support:no-agents", {
              ticketId,
              ticketNumber,
              message: "No agents are available right now. Your message has been saved as a support ticket — we'll reply soon.",
            });
          }
        }
      }, NO_AGENT_TIMEOUT_MS);
      noAgentTimers.set(ticketId, timer);

    } catch (err) {
      console.error("[live-chat] Error creating support request:", err);
      socket.emit("support:error", { error: "Failed to create support request" });
    }
  });

  // ── Agent: Accept a support request ───────────────────────────────
  socket.on("support:accept", async (data: { ticketId?: string }) => {
    if (!isStaff) return;
    const ticketId = data.ticketId?.trim();
    if (!ticketId) return;

    try {
      const ticket = await TicketModel.findOneAndUpdate(
        { _id: ticketId, status: TICKET_STATUS.OPEN, liveChatStatus: "WAITING" },
        {
          $set: {
            assignedTo: userId,
            assignedToRole: roles[0],
            status: TICKET_STATUS.IN_PROGRESS,
            liveChatStatus: "ACTIVE",
            firstResponseAt: new Date(),
          },
        },
        { new: true }
      ).exec();

      if (!ticket) {
        socket.emit("support:error", { error: "Already accepted by another agent." });
        return;
      }

      // Clear the no-agent timeout
      clearNoAgentTimer(ticketId);

      // Start auto-close timer
      resetAutoCloseTimer(io, ticketId);

      socket.join(`ticket:${ticketId}`);
      io.to(`ticket:${ticketId}`).emit("support:connected", { ticketId, agentName: name, agentId: userId });
      io.to("agents").emit("support:claimed", { ticketId });

      // Send student info to accepting agent
      const student = await (await import("../models/User.model.js")).UserModel
        .findById(ticket.createdBy).select("name username").lean().exec();
      socket.emit("support:accepted", {
        ticketId,
        studentName: (student as { name?: string })?.name ?? "Student",
        studentUsername: (student as { username?: string })?.username ?? "",
        ticketNumber: ticket.ticketNumber,
      });
    } catch (err) {
      console.error("[live-chat] Error accepting request:", err);
      socket.emit("support:error", { error: "Failed to accept request" });
    }
  });

  // ── Both: Send a chat message ─────────────────────────────────────
  const chatMessageCooldowns = new Map<string, number>();
  const CHAT_MSG_COOLDOWN_MS = 500; // min 500ms between messages per user
  const CHAT_MSG_MAX_LENGTH = 10000;

  socket.on("chat:message", async (data: { ticketId?: string; text?: string }) => {
    const ticketId = data.ticketId?.trim();
    const text = data.text?.trim();
    if (!ticketId || !text) return;

    // Rate limit: 1 message per 500ms per user
    const now = Date.now();
    const lastSent = chatMessageCooldowns.get(userId) ?? 0;
    if (now - lastSent < CHAT_MSG_COOLDOWN_MS) {
      socket.emit("support:error", { error: "Please wait before sending another message" });
      return;
    }
    chatMessageCooldowns.set(userId, now);

    // Length validation (matches TicketMessage schema maxlength)
    if (text.length > CHAT_MSG_MAX_LENGTH) {
      socket.emit("support:error", { error: `Message too long (max ${CHAT_MSG_MAX_LENGTH} characters)` });
      return;
    }

    try {
      const ticket = await TicketModel.findById(ticketId).lean().exec();
      if (!ticket) return;
      const isOwner = ticket.createdBy === userId || (ticket as { studentId?: string }).studentId === userId;
      const isAssigned = ticket.assignedTo === userId;
      if (!isOwner && !isAssigned && !isStaff) return;

      const msg = await TicketMessageModel.create({
        ticketId,
        senderId: userId,
        senderRole: isStaff ? (roles.includes("SUPPORT_AGENT") ? "SUPPORT_AGENT" : roles[0] ?? "ADMIN") : "STUDENT",
        message: text,
      });

      // Reset auto-close timer on activity
      resetAutoCloseTimer(io, ticketId);

      io.to(`ticket:${ticketId}`).emit("chat:message", {
        ticketId,
        messageId: String(msg._id),
        senderId: userId,
        senderName: name,
        senderRole: isStaff ? "STAFF" : "STUDENT",
        text,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[live-chat] Error sending message:", err);
    }
  });

  // ── Both: Typing indicator ────────────────────────────────────────
  socket.on("chat:typing", (data: { ticketId?: string }) => {
    const ticketId = data.ticketId?.trim();
    if (!ticketId) return;
    socket.to(`ticket:${ticketId}`).emit("chat:typing", { ticketId, senderId: userId, senderName: name });
  });

  socket.on("chat:stopped-typing", (data: { ticketId?: string }) => {
    const ticketId = data.ticketId?.trim();
    if (!ticketId) return;
    socket.to(`ticket:${ticketId}`).emit("chat:stopped-typing", { ticketId, senderId: userId });
  });

  // ── Agent: Close the chat ─────────────────────────────────────────
  socket.on("support:close", async (data: { ticketId?: string; resolution?: string }) => {
    if (!isStaff) return;
    const ticketId = data.ticketId?.trim();
    if (!ticketId) return;

    try {
      clearAutoCloseTimer(ticketId);
      await TicketModel.findByIdAndUpdate(ticketId, {
        $set: {
          status: TICKET_STATUS.RESOLVED,
          liveChatStatus: "CLOSED",
          resolvedBy: userId,
          resolution: data.resolution?.trim() || "Resolved via live chat",
          resolvedAt: new Date(),
        },
      }).exec();

      io.to(`ticket:${ticketId}`).emit("support:closed", { ticketId, closedBy: name });
    } catch (err) {
      console.error("[live-chat] Error closing chat:", err);
    }
  });

  // ── Agent: Transfer chat to another agent ─────────────────────────
  socket.on("support:transfer", async (data: { ticketId?: string; targetAgentId?: string }) => {
    if (!isStaff) return;
    const ticketId = data.ticketId?.trim();
    const targetAgentId = data.targetAgentId?.trim();
    if (!ticketId || !targetAgentId) return;

    try {
      // Validate target is a staff user
      const targetUser = await (await import("../models/User.model.js")).UserModel
        .findById(targetAgentId).select("name username roles").lean().exec();
      if (!targetUser) {
        socket.emit("support:error", { error: "Target agent not found" });
        return;
      }
      const targetRoles = (targetUser as { roles?: string[] }).roles ?? [];
      const targetIsStaff = targetRoles.some((r: string) => ["SUPER_ADMIN", "ADMIN", "TRAINER", "SUPPORT_AGENT"].includes(r));
      if (!targetIsStaff) {
        socket.emit("support:error", { error: "Target user is not a staff member" });
        return;
      }

      const ticket = await TicketModel.findOneAndUpdate(
        { _id: ticketId, liveChatStatus: "ACTIVE" },
        { $set: { assignedTo: targetAgentId } },
        { new: true }
      ).exec();
      if (!ticket) return;

      const targetName = (targetUser as { name?: string })?.name ?? "Agent";

      // Notify the ticket room
      io.to(`ticket:${ticketId}`).emit("support:transferred", {
        ticketId,
        fromAgent: name,
        toAgent: targetName,
        toAgentId: targetAgentId,
      });

      // Make the target agent join the room
      io.to(`user:${targetAgentId}`).emit("support:assigned-to-you", {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        studentName: ticket.subject,
        transferredFrom: name,
      });

      // Remove current agent from ticket room
      socket.leave(`ticket:${ticketId}`);

      // Reset auto-close timer
      resetAutoCloseTimer(io, ticketId);
    } catch (err) {
      console.error("[live-chat] Error transferring chat:", err);
    }
  });

  // ── Student: Rate the chat ────────────────────────────────────────
  socket.on("support:rate", async (data: { ticketId?: string; rating?: number }) => {
    const ticketId = data.ticketId?.trim();
    const rating = data.rating;
    if (!ticketId || !rating || rating < 1 || rating > 5) return;

    try {
      await TicketModel.findByIdAndUpdate(ticketId, {
        $set: { chatRating: Math.floor(rating) },
      }).exec();

      // Notify the agent
      io.to(`ticket:${ticketId}`).emit("support:rated", { ticketId, rating: Math.floor(rating) });
    } catch (err) {
      console.error("[live-chat] Error saving rating:", err);
    }
  });

  // ── Agent: Go online/offline (explicit toggle) ────────────────────
  socket.on("support:go-online", async () => {
    if (!isStaff) return;
    socket.join("agents");
    const count = await getOnlineAgentCount(io);
    io.to("agents").emit("support:agent-status", { agentId: userId, agentName: name, status: "online" });
    io.to("agents").emit("support:agents-count", { count });
  });

  socket.on("support:go-offline", async () => {
    if (!isStaff) return;
    socket.leave("agents");
    const count = await getOnlineAgentCount(io);
    io.to("agents").emit("support:agent-status", { agentId: userId, agentName: name, status: "offline" });
    io.to("agents").emit("support:agents-count", { count });
  });

  // ── Agent: Get online agents list ─────────────────────────────────
  socket.on("support:get-online-agents", async () => {
    if (!isStaff) return;
    const room = io.sockets.adapter.rooms.get("agents");
    const agentSocketIds = room ? [...room] : [];
    const agents: Array<{ id: string; name: string }> = [];
    for (const sid of agentSocketIds) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.data.userId !== userId) {
        agents.push({ id: s.data.userId, name: s.data.name });
      }
    }
    socket.emit("support:online-agents", { agents });
  });

  // ── Agent: Get current waiting requests ───────────────────────────
  socket.on("support:get-waiting", async () => {
    if (!isStaff) return;
    try {
      const waiting = await TicketModel.find({
        isLiveChat: true, liveChatStatus: "WAITING", status: TICKET_STATUS.OPEN,
      }).sort({ createdAt: -1 }).limit(50).lean().exec();

      const userIds = waiting.map((t) => t.createdBy);
      const users = await (await import("../models/User.model.js")).UserModel
        .find({ _id: { $in: userIds } }).select("name username").lean().exec();
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      const requests = waiting.map((t) => {
        const u = userMap.get(t.createdBy);
        return {
          ticketId: String(t._id), ticketNumber: t.ticketNumber,
          studentName: (u as { name?: string })?.name ?? "Student",
          studentUsername: (u as { username?: string })?.username ?? "",
          message: t.description,
          createdAt: (t as { createdAt?: Date }).createdAt?.toISOString(),
        };
      });
      socket.emit("support:waiting-list", { requests });
    } catch (err) {
      console.error("[live-chat] Error fetching waiting list:", err);
    }
  });

  // ── Agent: Get active chats assigned to me ────────────────────────
  socket.on("support:get-my-chats", async () => {
    if (!isStaff) return;
    try {
      const active = await TicketModel.find({
        isLiveChat: true, liveChatStatus: "ACTIVE", assignedTo: userId,
      }).sort({ updatedAt: -1 }).limit(20).lean().exec();

      const userIds = active.map((t) => t.createdBy);
      const users = await (await import("../models/User.model.js")).UserModel
        .find({ _id: { $in: userIds } }).select("name username").lean().exec();
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      const chats = active.map((t) => {
        const u = userMap.get(t.createdBy);
        return {
          ticketId: String(t._id), ticketNumber: t.ticketNumber,
          studentName: (u as { name?: string })?.name ?? "Student",
          studentUsername: (u as { username?: string })?.username ?? "",
          subject: t.subject,
          createdAt: (t as { createdAt?: Date }).createdAt?.toISOString(),
        };
      });
      socket.emit("support:my-chats", { chats });
    } catch (err) {
      console.error("[live-chat] Error fetching active chats:", err);
    }
  });

  // ── Get messages for a ticket ─────────────────────────────────────
  socket.on("chat:get-messages", async (data: { ticketId?: string }) => {
    const ticketId = data.ticketId?.trim();
    if (!ticketId) return;
    try {
      const ticket = await TicketModel.findById(ticketId).lean().exec();
      if (!ticket) return;
      const isOwner = ticket.createdBy === userId || (ticket as { studentId?: string }).studentId === userId;
      if (!isOwner && !isStaff) return;

      const messages = await TicketMessageModel.find({ ticketId })
        .sort({ createdAt: 1 }).limit(200).lean().exec();

      socket.emit("chat:messages", {
        ticketId,
        messages: messages.map((m) => ({
          messageId: String(m._id), senderId: m.senderId, senderRole: m.senderRole,
          text: m.message, timestamp: (m as { createdAt?: Date }).createdAt?.toISOString(),
        })),
      });
      socket.join(`ticket:${ticketId}`);
    } catch (err) {
      console.error("[live-chat] Error fetching messages:", err);
    }
  });

  // ── Cleanup on disconnect ─────────────────────────────────────────
  socket.on("disconnect", async () => {
    if (isStaff) {
      const count = await getOnlineAgentCount(io);
      io.to("agents").emit("support:agents-count", { count });
    }
  });
}
