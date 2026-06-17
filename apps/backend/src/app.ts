import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import { getEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import { helmetMiddleware } from "./middleware/security.middleware.js";
import { csrfProtection } from "./middleware/csrf.middleware.js";
import { authRateLimiter, apiRateLimiter } from "./middleware/rateLimit.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { studentRoutes } from "./routes/student.routes.js";
import { parentRoutes } from "./routes/parent.routes.js";
import { courseRoutes } from "./routes/course.routes.js";
import { batchRoutes } from "./routes/batch.routes.js";
import { assignmentRoutes } from "./routes/assignment.routes.js";
import { attendanceRoutes } from "./routes/attendance.routes.js";
import { generalAttendanceRoutes } from "./routes/generalAttendance.routes.js";
import { certificateRoutes } from "./routes/certificate.routes.js";
import { globalModuleRoutes } from "./routes/globalModule.routes.js";
import { globalAssignmentRoutes } from "./routes/globalAssignment.routes.js";
import { enrollmentRoutes } from "./routes/enrollment.routes.js";
import { progressRoutes } from "./routes/progress.routes.js";
import { verifyRoutes } from "./routes/verify.routes.js";
import { skillProfileRoutes } from "./routes/skillProfile.routes.js";
import { achievementRoutes } from "./routes/achievement.routes.js";
import { auditRoutes } from "./routes/audit.routes.js";
import { profileRoutes } from "./routes/profile.routes.js";
import { shopRoutes } from "./routes/shop.routes.js";
import { publicRoutes } from "./routes/public.routes.js";
import { r2VideoRoutes } from "./routes/r2Video.routes.js";
import {
  contentProtectionConfigRoutes,
  contentProtectionStudentRoutes,
} from "./routes/contentProtection.routes.js";
import { leaveRoutes } from "./routes/leave.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { ticketRoutes } from "./routes/ticket.routes.js";
import {
  courseLearningPlanRouter,
  studentMilestoneRouter,
  adminMilestoneRouter,
  learningPlanAnalyticsRouter,
} from "./routes/learningPlan.routes.js";
import { exportImportRoutes } from "./routes/exportImport.routes.js";
import { knowledgeReaderRouter, knowledgeAdminRouter } from "./routes/knowledge.routes.js";

const app = express();
const { corsOrigins, isProduction } = getEnv();

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmetMiddleware());
app.use(compression());
app.use((req, _res, next) => {
  // Be tolerant of accidental double slashes from clients/proxies (e.g. //api/auth/google).
  if (req.url.includes("//")) {
    const queryIndex = req.url.indexOf("?");
    const path = queryIndex >= 0 ? req.url.slice(0, queryIndex) : req.url;
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    req.url = `${path.replace(/\/{2,}/g, "/")}${query}`;
  }
  next();
});
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : false,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "10mb" }));
app.use(mongoSanitize());
app.use(csrfProtection);

app.get("/", (_req, res) => res.status(200).json({ status: "ok", service: "funt-platform-api" }));
app.use("/health", healthRouter);

// CSRF token endpoint — frontends call this on boot to get their CSRF cookie
app.get("/api/csrf-token", (_req, res) => {
  // The csrfProtection middleware already sets the cookie on GET requests.
  // This endpoint simply confirms the cookie was set.
  res.status(200).json({ success: true });
});

app.options("/api/auth", (_, res) => res.sendStatus(204));
app.use("/api/auth", authRateLimiter, authRoutes);
app.use(apiRateLimiter);

app.use("/api/public", publicRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/general-attendance", generalAttendanceRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/global-modules", globalModuleRoutes);
// Legacy alias — prefer /api/global-modules. Will be removed in a future version.
app.use("/api/global-chapters", (_req, res, next) => {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "2025-12-31");
  res.setHeader("Link", '</api/global-modules>; rel="successor-version"');
  next();
}, globalModuleRoutes);
app.use("/api/global-assignments", globalAssignmentRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/skills", skillProfileRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/admin/videos", r2VideoRoutes);
app.use("/api/config/content-protection", contentProtectionConfigRoutes);
app.use("/api/student/content-protection", contentProtectionStudentRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/courses/:id/learning-plan", courseLearningPlanRouter);
app.use("/api/student", studentMilestoneRouter);
app.use("/api/admin", adminMilestoneRouter);
app.use("/api/analytics", learningPlanAnalyticsRouter);
app.use("/api/admin/data", exportImportRoutes);
app.use("/api/knowledge", knowledgeReaderRouter);
app.use("/api/admin/knowledge", knowledgeAdminRouter);
app.use("/verify", verifyRoutes);

// 404 catch-all — must be after all routes and before error handler
app.use((_req, _res, next) => {
  next(new AppError("Endpoint not found", 404));
});

app.use(errorHandler);

export default app;
