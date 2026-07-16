/**
 * Quiz Controller — admin + student endpoints.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import * as quizService from "../services/quiz.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export const createQuiz = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const createdBy = getUserId(req);
  // Only pass validated schema fields — don't spread raw body
  const { title, description, type, status, questions, passingScore, maxAttempts,
    timeLimitMinutes, shuffleQuestions, shuffleOptions, questionsPerAttempt, requiredForCertificate } = req.body;
  const data = await quizService.createQuiz({
    title, description, type, status, questions, passingScore, maxAttempts,
    timeLimitMinutes, shuffleQuestions, shuffleOptions, questionsPerAttempt, requiredForCertificate,
    createdBy,
  });
  successRes(res, data, "Quiz created", 201);
});

export const listQuizzes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const data = await quizService.listQuizzes({ type, status, search });
  successRes(res, data);
});

export const getQuiz = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Quiz ID is required", 400);
  const data = await quizService.getQuizForAdmin(id);
  successRes(res, data);
});

export const updateQuiz = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Quiz ID is required", 400);
  const data = await quizService.updateQuiz(id, req.body);
  successRes(res, data, "Quiz updated");
});

export const archiveQuiz = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Quiz ID is required", 400);
  const data = await quizService.archiveQuiz(id);
  successRes(res, data, "Quiz archived");
});

export const deleteQuiz = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  if (!id) throw new AppError("Quiz ID is required", 400);
  const data = await quizService.deleteQuiz(id);
  successRes(res, data, "Quiz deleted");
});

export const listQuizzesForLinking = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type as string | undefined;
  const data = await quizService.listQuizzesForLinking(type);
  successRes(res, data);
});

// ─── Student Endpoints ────────────────────────────────────────────────────────

export const getQuizForStudent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const quizId = req.params.quizId;
  if (!quizId) throw new AppError("Quiz ID is required", 400);
  const data = await quizService.getQuizForStudent(quizId);
  successRes(res, data);
});

export const startQuizAttempt = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const data = await quizService.startQuizAttempt({
    studentId,
    ...req.body,
  });
  successRes(res, data, "Attempt started", 201);
});

export const saveQuizAnswer = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const attemptId = req.params.attemptId;
  if (!attemptId) throw new AppError("Attempt ID is required", 400);
  const { questionId, selectedOptionId } = req.body;
  const data = await quizService.saveQuizAnswer(attemptId, studentId, questionId, selectedOptionId ?? null);
  successRes(res, data);
});

export const submitQuizAttempt = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const attemptId = req.params.attemptId;
  if (!attemptId) throw new AppError("Attempt ID is required", 400);
  const data = await quizService.submitQuizAttempt(attemptId, studentId, req.body?.answers);
  successRes(res, data, "Quiz submitted");
});

export const getQuizAttempts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const quizId = req.params.quizId;
  const batchId = req.query.batchId as string;
  const courseId = req.query.courseId as string;
  if (!quizId || !batchId || !courseId) {
    throw new AppError("quizId, batchId, and courseId are required", 400);
  }
  const data = await quizService.getQuizAttempts(studentId, quizId, batchId, courseId);
  successRes(res, data);
});

export const getQuizAttemptDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const attemptId = req.params.attemptId;
  if (!attemptId) throw new AppError("Attempt ID is required", 400);
  const data = await quizService.getQuizAttemptDetail(attemptId, studentId);
  successRes(res, data);
});
