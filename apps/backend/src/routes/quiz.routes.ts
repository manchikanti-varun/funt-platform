/**
 * Quiz Routes
 *
 * Admin:
 *   POST   /api/quizzes              — create quiz
 *   GET    /api/quizzes              — list quizzes (filterable)
 *   GET    /api/quizzes/for-linking  — list active quizzes for dropdown
 *   GET    /api/quizzes/:id          — get quiz with answers (admin only)
 *   PUT    /api/quizzes/:id          — update quiz
 *   PATCH  /api/quizzes/:id/archive  — archive quiz
 *
 * Student:
 *   GET    /api/student/quizzes/:quizId            — get quiz info (no answers)
 *   POST   /api/student/quizzes/attempt            — start attempt
 *   PATCH  /api/student/quizzes/attempt/:attemptId — save answer
 *   POST   /api/student/quizzes/attempt/:attemptId/submit — submit
 *   GET    /api/student/quizzes/:quizId/attempts   — attempt history
 *   GET    /api/student/quizzes/attempt/:attemptId — attempt detail
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { ROLE } from "@funt-platform/constants";
import {
  createQuizSchema,
  updateQuizSchema,
  startQuizAttemptSchema,
  saveQuizAnswerSchema,
  submitQuizAttemptSchema,
} from "../schemas/index.js";
import {
  createQuiz,
  listQuizzes,
  getQuiz,
  updateQuiz,
  archiveQuiz,
  listQuizzesForLinking,
  getQuizForStudent,
  startQuizAttempt,
  saveQuizAnswer,
  submitQuizAttempt,
  getQuizAttempts,
  getQuizAttemptDetail,
} from "../controllers/quiz.controller.js";

const ADMIN_ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN] as const;

// ─── Admin Router ─────────────────────────────────────────────────────────────

export const quizAdminRoutes = Router();
quizAdminRoutes.use(authMiddleware, requireRoles(...ADMIN_ROLES));

quizAdminRoutes.post("/", validateBody(createQuizSchema), createQuiz);
quizAdminRoutes.get("/", listQuizzes);
quizAdminRoutes.get("/for-linking", listQuizzesForLinking);
quizAdminRoutes.get("/:id", getQuiz);
quizAdminRoutes.put("/:id", validateBody(updateQuizSchema), updateQuiz);
quizAdminRoutes.patch("/:id/archive", archiveQuiz);

// ─── Student Router ───────────────────────────────────────────────────────────

export const quizStudentRoutes = Router();
quizStudentRoutes.use(authMiddleware, requireRoles(ROLE.STUDENT));

quizStudentRoutes.get("/:quizId", getQuizForStudent);
quizStudentRoutes.post("/attempt", validateBody(startQuizAttemptSchema), startQuizAttempt);
quizStudentRoutes.patch("/attempt/:attemptId", validateBody(saveQuizAnswerSchema), saveQuizAnswer);
quizStudentRoutes.post("/attempt/:attemptId/submit", validateBody(submitQuizAttemptSchema), submitQuizAttempt);
quizStudentRoutes.get("/:quizId/attempts", getQuizAttempts);
quizStudentRoutes.get("/attempt/:attemptId/detail", getQuizAttemptDetail);
