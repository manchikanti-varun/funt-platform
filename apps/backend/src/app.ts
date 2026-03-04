import express from "express";
import cors from "cors";
import { getEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { helmetMiddleware } from "./middleware/security.middleware.js";
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

const app = express();
const { corsOrigins, isProduction } = getEnv();

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmetMiddleware());
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : false,
  credentials: true,
}));
app.use(express.json({ limit: "512kb" }));

app.use("/health", healthRouter);

app.use("/api/auth", authRateLimiter, authRoutes);
app.use(apiRateLimiter);

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
app.use("/api/global-assignments", globalAssignmentRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/skills", skillProfileRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/profile", profileRoutes);
app.use("/verify", verifyRoutes);

app.use(errorHandler);

export default app;
