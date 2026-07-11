import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import { getEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import { helmetMiddleware } from "./middleware/security.middleware.js";
import { csrfProtection, setCsrfCookie, CSRF_COOKIE_NAME } from "./middleware/csrf.middleware.js";
import { authRateLimiter, apiRateLimiter } from "./middleware/rateLimit.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { checkUsernameAvailability } from "./controllers/auth.controller.js";
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
import { letterRoutes } from "./routes/letter.routes.js";
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
import { r2ImageRoutes } from "./routes/r2Image.routes.js";
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
import { paymentPromiseRoutes } from "./routes/paymentPromise.routes.js";
import { quizAdminRoutes, quizStudentRoutes } from "./routes/quiz.routes.js";
import { franchiseAdminRoutes, franchiseRoutes } from "./routes/franchise.routes.js";

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
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "16mb" }));
// Sanitize MongoDB operator injection from user inputs (defense-in-depth).
// Note: we deliberately exclude req.headers — sanitizing headers breaks
// Express's req.get() and our CSRF X-CSRF-Token header reading.
app.use((req, _res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.query) req.query = mongoSanitize.sanitize(req.query) as typeof req.query;
  if (req.params) req.params = mongoSanitize.sanitize(req.params) as typeof req.params;
  next();
});
app.use(csrfProtection);

app.get("/", (_req, res) => res.status(200).json({ status: "ok", service: "funt-platform-api" }));
app.use("/health", healthRouter);

// CSRF token endpoint — frontends call this on boot to get their CSRF token.
// The token is returned in BOTH the cookie AND the response body.
// This handles the cross-origin case where admin.funt.in can't read cookies set by api.funt.in.
app.get("/api/csrf-token", (req, res) => {
  // The csrfProtection middleware already sets the cookie on GET requests if missing.
  // Read the token from the cookie (already present) or from the newly set response cookie.
  const cookieToken = (req.cookies as Record<string, string>)?.[CSRF_COOKIE_NAME];
  if (cookieToken) {
    res.status(200).json({ success: true, csrfToken: cookieToken });
  } else {
    // No cookie in request — generate one and return it in both cookie and body.
    const newToken = setCsrfCookie(res);
    res.status(200).json({ success: true, csrfToken: newToken });
  }
});

app.options("/api/auth", (_, res) => res.sendStatus(204));
// Username availability is a read-only GET used on every keystroke during signup.
// It must NOT consume the stricter authRateLimiter budget — route it separately first.
app.get("/api/auth/username-availability", apiRateLimiter, checkUsernameAvailability);
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
app.use("/api/letters", letterRoutes);
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
app.use("/api/admin/images", r2ImageRoutes);
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
app.use("/api/payment-promises", paymentPromiseRoutes);
app.use("/api/quizzes", quizAdminRoutes);
app.use("/api/student/quizzes", quizStudentRoutes);
app.use("/api/franchise/admin", franchiseAdminRoutes);
app.use("/api/franchise", franchiseRoutes);
import { referralRoutes } from "./routes/referral.routes.js";
app.use("/api/referral", referralRoutes);
app.use("/verify", verifyRoutes);

// 404 catch-all — must be after all routes and before error handler
app.use((_req, _res, next) => {
  next(new AppError("Endpoint not found", 404));
});

app.use(errorHandler);

export default app;
