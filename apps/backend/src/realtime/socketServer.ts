/**
 * Socket.IO Server Setup — Live Support Chat
 *
 * Attaches to the existing HTTP server. Uses the /support namespace.
 * Authentication via JWT token from cookie or handshake auth.
 *
 * Architecture:
 *   - Students connect and emit "support:request" to start a chat
 *   - Admins/staff connect and receive "support:incoming" events
 *   - When an agent accepts, both join a private room
 *   - Messages flow bidirectionally via "chat:message"
 */

import { Server as SocketServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { getEnv } from "../config/env.js";
import { verifyToken } from "../utils/jwt.js";
import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";
import { registerSupportHandlers } from "./supportHandlers.js";

let io: SocketServer | null = null;

export function getIO(): SocketServer | null {
  return io;
}

const STAFF_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.TRAINER, ROLE.SUPPORT_AGENT];

export function initSocketServer(httpServer: HTTPServer): SocketServer {
  const { corsOrigins, jwtSecret } = getEnv();

  io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigins.length > 0 ? corsOrigins : false,
      credentials: true,
    },
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  // ── Authentication middleware ─────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      // Try auth token from handshake
      const token =
        socket.handshake.auth?.token ||
        extractCookieToken(socket.handshake.headers.cookie);

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = verifyToken(token, jwtSecret);
      const user = await UserModel.findById(payload.userId)
        .select("_id username name roles status")
        .lean()
        .exec();

      if (!user || user.status !== "ACTIVE") {
        return next(new Error("User not found or inactive"));
      }

      // Attach user info to socket
      socket.data.userId = String(user._id);
      socket.data.username = user.username ?? "";
      socket.data.name = user.name ?? "";
      socket.data.roles = user.roles as string[];
      socket.data.isStaff = user.roles.some((r: string) => STAFF_ROLES.includes(r as typeof ROLE.ADMIN));

      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ── Connection handler ────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { userId, isStaff } = socket.data;

    // Join personal room for targeted messages
    socket.join(`user:${userId}`);

    // Staff join the agents room
    if (isStaff) {
      socket.join("agents");
    }

    registerSupportHandlers(io!, socket);

    socket.on("disconnect", () => {
      // Cleanup handled in supportHandlers
    });
  });

  console.log("[socket.io] Live support chat initialized");
  return io;
}

/**
 * Extract JWT from cookie header string.
 * Looks for funt_auth_admin or funt_auth_lms cookies.
 */
function extractCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("funt_auth_admin=") || cookie.startsWith("funt_auth_lms=") || cookie.startsWith("funt_auth_support=")) {
      return cookie.split("=").slice(1).join("=");
    }
  }
  return null;
}
