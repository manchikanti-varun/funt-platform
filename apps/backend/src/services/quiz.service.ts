/**
 * Quiz Service
 *
 * Handles:
 *   - Admin CRUD for quizzes (question bank management)
 *   - Student quiz flow: start attempt → save answers → submit → auto-grade
 *   - Integration with chapter/milestone/course completion
 */

import { QuizModel } from "../models/Quiz.model.js";
import { QuizAttemptModel } from "../models/QuizAttempt.model.js";
import { ChapterProgressModel } from "../models/ModuleProgress.model.js";
import { AppError } from "../utils/AppError.js";
import { generateQuizId, generateQuizAttemptId } from "../utils/funtIdGenerator.js";
import {
  QUIZ_STATUS,
  QUIZ_ATTEMPT_STATUS,
} from "@funt-platform/constants";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionDoc {
  questionId: string;
  type: string;
  text: string;
  imageUrl?: string;
  options: Array<{ optionId: string; text: string; imageUrl?: string; isCorrect: boolean }>;
  explanation?: string;
  marks: number;
  order: number;
}

interface QuizDoc {
  _id: unknown;
  quizId?: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  questions: QuestionDoc[];
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionsPerAttempt: number;
  requiredForCertificate: boolean;
  createdBy: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function findQuizByParam(idParam: string): Promise<QuizDoc | null> {
  const doc = await QuizModel.findOne({
    $or: [
      { quizId: idParam },
      { _id: /^[a-f\d]{24}$/i.test(idParam) ? idParam : "000000000000000000000000" },
    ],
  })
    .lean()
    .exec();
  return doc as QuizDoc | null;
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export async function createQuiz(
  input: Partial<QuizDoc> & { createdBy: string }
): Promise<unknown> {
  const quizId = await generateQuizId();
  const doc = await QuizModel.create({ ...input, quizId });
  return doc.toJSON();
}

export async function listQuizzes(filters?: {
  type?: string;
  status?: string;
  search?: string;
}): Promise<unknown[]> {
  const query: Record<string, unknown> = {};
  if (filters?.type) query.type = filters.type;
  if (filters?.status) query.status = filters.status;
  if (filters?.search) {
    const term = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.title = { $regex: term, $options: "i" };
  }
  const docs = await QuizModel.find(query)
    .sort({ updatedAt: -1 })
    .select("quizId title type status passingScore maxAttempts timeLimitMinutes questions createdBy updatedAt")
    .lean()
    .exec();
  return docs.map((d) => ({
    _id: String((d as { _id: unknown })._id),
    quizId: (d as { quizId?: string }).quizId,
    title: (d as { title: string }).title,
    type: (d as { type: string }).type,
    status: (d as { status: string }).status,
    passingScore: (d as { passingScore: number }).passingScore,
    maxAttempts: (d as { maxAttempts: number }).maxAttempts,
    timeLimitMinutes: (d as { timeLimitMinutes: number }).timeLimitMinutes,
    questionCount: Array.isArray((d as { questions?: unknown[] }).questions) ? (d as { questions: unknown[] }).questions.length : 0,
    updatedAt: (d as { updatedAt?: Date }).updatedAt,
  }));
}

export async function getQuizById(idParam: string): Promise<QuizDoc> {
  const doc = await findQuizByParam(idParam);
  if (!doc) throw new AppError("Quiz not found", 404);
  return doc;
}

export async function getQuizForAdmin(idParam: string): Promise<QuizDoc> {
  return getQuizById(idParam);
}

export async function updateQuiz(
  idParam: string,
  updates: Partial<QuizDoc>
): Promise<unknown> {
  const quiz = await findQuizByParam(idParam);
  if (!quiz) throw new AppError("Quiz not found", 404);
  const updated = await QuizModel.findByIdAndUpdate(
    quiz._id,
    { $set: updates },
    { new: true }
  )
    .lean()
    .exec();
  return updated;
}

export async function archiveQuiz(idParam: string): Promise<unknown> {
  return updateQuiz(idParam, { status: QUIZ_STATUS.ARCHIVED } as Partial<QuizDoc>);
}

export async function deleteQuiz(idParam: string): Promise<{ id: string; quizId?: string; title: string; deleted: boolean }> {
  const quiz = await findQuizByParam(idParam);
  if (!quiz) throw new AppError("Quiz not found", 404);

  const mongoId = String(quiz._id);

  // Check for dependent quiz attempts
  const attemptCount = await QuizAttemptModel.countDocuments({
    quizId: { $in: [mongoId, quiz.quizId].filter(Boolean) },
  }).exec();

  if (attemptCount > 0) {
    throw new AppError(
      `Cannot delete quiz — it has ${attemptCount} student attempt${attemptCount === 1 ? "" : "s"}. Archive it instead.`,
      409
    );
  }

  await QuizModel.deleteOne({ _id: quiz._id }).exec();
  return { id: mongoId, quizId: quiz.quizId, title: quiz.title, deleted: true };
}

export async function listQuizzesForLinking(type?: string): Promise<unknown[]> {
  const query: Record<string, unknown> = {
    status: { $in: [QUIZ_STATUS.ACTIVE, QUIZ_STATUS.DRAFT] },
  };
  if (type) query.type = type;
  const docs = await QuizModel.find(query)
    .sort({ title: 1 })
    .select("quizId title type status questions passingScore")
    .lean()
    .exec();
  return docs.map((d) => ({
    ...d,
    questionCount: Array.isArray((d as { questions?: unknown[] }).questions)
      ? (d as { questions: unknown[] }).questions.length
      : 0,
  }));
}

// ─── Student: Get Quiz (without correct answers) ──────────────────────────────

export async function getQuizForStudent(
  quizIdParam: string
): Promise<{
  quizId: string;
  title: string;
  description: string;
  type: string;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionsPerAttempt: number;
  questionCount: number;
}> {
  const quiz = await findQuizByParam(quizIdParam);
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.status === QUIZ_STATUS.ARCHIVED) throw new AppError("Quiz is no longer available", 404);
  return {
    quizId: quiz.quizId ?? String(quiz._id),
    title: quiz.title,
    description: quiz.description ?? "",
    type: quiz.type,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    timeLimitMinutes: quiz.timeLimitMinutes,
    shuffleQuestions: quiz.shuffleQuestions,
    shuffleOptions: quiz.shuffleOptions,
    questionsPerAttempt: quiz.questionsPerAttempt,
    questionCount: quiz.questions.length,
  };
}

// ─── Student: Start Attempt ───────────────────────────────────────────────────

export async function startQuizAttempt(input: {
  studentId: string;
  quizId: string;
  batchId: string;
  courseId: string;
  chapterOrder?: number;
  milestoneId?: string;
}): Promise<unknown> {
  const { studentId, quizId, batchId, courseId, chapterOrder, milestoneId } = input;

  const quiz = await findQuizByParam(quizId);
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.status === QUIZ_STATUS.ARCHIVED) throw new AppError("Quiz is no longer available", 404);

  // ── Verify enrollment ────────────────────────────────────────────────
  const { EnrollmentModel } = await import("../models/Enrollment.model.js");
  const enrollment = await EnrollmentModel.findOne({
    studentId,
    batchId,
    status: { $in: ["ACTIVE", "COMPLETED"] },
  }).lean().exec();
  if (!enrollment) {
    throw new AppError("You must be enrolled in this course to take the quiz", 403);
  }

  // Check max attempts (0 = unlimited)
  if (quiz.maxAttempts > 0) {
    const completedCount = await QuizAttemptModel.countDocuments({
      studentId,
      quizId: quiz.quizId ?? String(quiz._id),
      batchId,
      courseId,
      status: QUIZ_ATTEMPT_STATUS.COMPLETED,
      ...(chapterOrder !== undefined ? { chapterOrder } : {}),
      ...(milestoneId ? { milestoneId } : {}),
    }).exec();
    if (completedCount >= quiz.maxAttempts) {
      throw new AppError(
        `Maximum attempts (${quiz.maxAttempts}) reached for this quiz`,
        400
      );
    }
  }

  // Check for existing IN_PROGRESS attempt — resume it (if not expired)
  const existing = await QuizAttemptModel.findOne({
    studentId,
    quizId: quiz.quizId ?? String(quiz._id),
    batchId,
    courseId,
    status: QUIZ_ATTEMPT_STATUS.IN_PROGRESS,
    ...(chapterOrder !== undefined ? { chapterOrder } : {}),
    ...(milestoneId ? { milestoneId } : {}),
  }).exec();

  if (existing) {
    // Check if the existing attempt has expired
    if (quiz.timeLimitMinutes > 0) {
      const startedAt = (existing as { startedAt: Date }).startedAt;
      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      const allowedMs = quiz.timeLimitMinutes * 60 * 1000;
      if (elapsedMs > allowedMs) {
        // Auto-submit the expired attempt with whatever answers exist
        const expiredResult = await submitQuizAttempt(
          (existing as { attemptId?: string }).attemptId ?? String((existing as { _id: unknown })._id),
          studentId
        );
        // Return the result so the frontend shows the expired result
        return { expired: true, result: expiredResult };
      }
    }
    return formatAttemptForStudent(existing.toJSON ? existing.toJSON() : existing, quiz);
  }

  // Determine attempt number
  const prevCount = await QuizAttemptModel.countDocuments({
    studentId,
    quizId: quiz.quizId ?? String(quiz._id),
    batchId,
    courseId,
    ...(chapterOrder !== undefined ? { chapterOrder } : {}),
    ...(milestoneId ? { milestoneId } : {}),
  }).exec();
  const attemptNumber = prevCount + 1;

  // Select questions for this attempt
  let selectedQuestions = [...quiz.questions].sort((a, b) => a.order - b.order);

  // Random selection from pool if configured
  const poolSize = quiz.questionsPerAttempt;
  if (poolSize > 0 && poolSize < selectedQuestions.length) {
    selectedQuestions = shuffleArray(selectedQuestions).slice(0, poolSize);
  }

  // Shuffle questions if configured
  if (quiz.shuffleQuestions) {
    selectedQuestions = shuffleArray(selectedQuestions);
  }

  const questionOrder = selectedQuestions.map((q) => q.questionId);

  // Shuffle options per question if configured
  const optionOrders: Record<string, string[]> = {};
  for (const q of selectedQuestions) {
    if (quiz.shuffleOptions) {
      optionOrders[q.questionId] = shuffleArray(q.options).map((o) => o.optionId);
    } else {
      optionOrders[q.questionId] = q.options.map((o) => o.optionId);
    }
  }

  const attemptId = await generateQuizAttemptId();

  const attempt = await QuizAttemptModel.create({
    attemptId,
    studentId,
    quizId: quiz.quizId ?? String(quiz._id),
    batchId,
    courseId,
    chapterOrder,
    milestoneId,
    attemptNumber,
    status: QUIZ_ATTEMPT_STATUS.IN_PROGRESS,
    questionOrder,
    optionOrders,
    answers: [],
    startedAt: new Date(),
  });

  return formatAttemptForStudent(attempt.toJSON(), quiz);
}

// ─── Format attempt for student (strip correct answers) ───────────────────────

function formatAttemptForStudent(attempt: unknown, quiz: QuizDoc) {
  const a = attempt as {
    attemptId?: string;
    _id?: unknown;
    attemptNumber: number;
    status: string;
    questionOrder: string[];
    optionOrders: Record<string, string[]> | Map<string, string[]>;
    answers: Array<{ questionId: string; selectedOptionId?: string | null }>;
    startedAt: Date;
    timeTakenSeconds?: number;
  };

  // Build a map for option orders (handles both Map and plain object)
  const optionOrdersMap: Record<string, string[]> = {};
  if (a.optionOrders instanceof Map) {
    a.optionOrders.forEach((val, key) => { optionOrdersMap[key] = val; });
  } else if (a.optionOrders && typeof a.optionOrders === "object") {
    Object.assign(optionOrdersMap, a.optionOrders);
  }

  const questions = a.questionOrder.map((qId) => {
    const q = quiz.questions.find((x) => x.questionId === qId);
    if (!q) return null;
    const orderedOptionIds = optionOrdersMap[qId] ?? q.options.map((o) => o.optionId);
    const orderedOptions = orderedOptionIds
      .map((oId) => q.options.find((o) => o.optionId === oId))
      .filter(Boolean)
      .map((o) => ({ optionId: o!.optionId, text: o!.text, imageUrl: o!.imageUrl }));
    const saved = a.answers.find((ans) => ans.questionId === qId);
    return {
      questionId: q.questionId,
      text: q.text,
      imageUrl: q.imageUrl,
      marks: q.marks,
      options: orderedOptions,
      savedAnswer: saved?.selectedOptionId ?? null,
    };
  }).filter(Boolean);

  return {
    attemptId: a.attemptId ?? String(a._id),
    attemptNumber: a.attemptNumber,
    status: a.status,
    startedAt: a.startedAt,
    timeLimitMinutes: quiz.timeLimitMinutes,
    totalQuestions: questions.length,
    questions,
  };
}

// ─── Student: Save Answer (auto-save) ─────────────────────────────────────────

export async function saveQuizAnswer(
  attemptIdParam: string,
  studentId: string,
  questionId: string,
  selectedOptionId: string | null
): Promise<{ saved: boolean }> {
  const attempt = await QuizAttemptModel.findOne({
    $or: [
      { attemptId: attemptIdParam },
      { _id: /^[a-f\d]{24}$/i.test(attemptIdParam) ? attemptIdParam : "000000000000000000000000" },
    ],
    studentId,
    status: QUIZ_ATTEMPT_STATUS.IN_PROGRESS,
  }).exec();

  if (!attempt) throw new AppError("Attempt not found or already submitted", 404);

  // Verify the question belongs to this attempt
  const qOrder = (attempt as { questionOrder: string[] }).questionOrder;
  if (!qOrder.includes(questionId)) {
    throw new AppError("Question not part of this attempt", 400);
  }

  // Upsert the answer in the answers array
  const answers = (attempt as { answers: Array<{ questionId: string; selectedOptionId?: string | null }> }).answers;
  const existingIdx = answers.findIndex((a) => a.questionId === questionId);
  if (existingIdx >= 0) {
    answers[existingIdx].selectedOptionId = selectedOptionId;
  } else {
    answers.push({ questionId, selectedOptionId } as never);
  }

  await QuizAttemptModel.updateOne(
    { _id: (attempt as { _id: unknown })._id },
    { $set: { answers } }
  ).exec();

  return { saved: true };
}

// ─── Student: Submit Attempt (auto-grade) ─────────────────────────────────────

export async function submitQuizAttempt(
  attemptIdParam: string,
  studentId: string,
  finalAnswers?: Array<{ questionId: string; selectedOptionId?: string | null }>
): Promise<unknown> {
  const attempt = await QuizAttemptModel.findOne({
    $or: [
      { attemptId: attemptIdParam },
      { _id: /^[a-f\d]{24}$/i.test(attemptIdParam) ? attemptIdParam : "000000000000000000000000" },
    ],
    studentId,
    status: QUIZ_ATTEMPT_STATUS.IN_PROGRESS,
  }).exec();

  if (!attempt) throw new AppError("Attempt not found or already submitted", 404);

  const attemptObj = attempt.toJSON() as {
    _id: unknown;
    attemptId?: string;
    quizId: string;
    batchId: string;
    courseId: string;
    chapterOrder?: number;
    milestoneId?: string;
    attemptNumber: number;
    questionOrder: string[];
    optionOrders: Record<string, string[]> | Map<string, string[]>;
    answers: Array<{ questionId: string; selectedOptionId?: string | null }>;
    startedAt: Date;
  };

  // Load the quiz for grading
  const quiz = await findQuizByParam(attemptObj.quizId);
  if (!quiz) throw new AppError("Quiz no longer exists", 500);

  // ── Time limit enforcement ──────────────────────────────────────────────
  if (quiz.timeLimitMinutes > 0) {
    const elapsedMs = Date.now() - new Date(attemptObj.startedAt).getTime();
    const allowedMs = quiz.timeLimitMinutes * 60 * 1000;
    // Allow 30-second grace period for network latency
    const graceMs = 30 * 1000;
    if (elapsedMs > allowedMs + graceMs) {
      // Auto-submit with whatever answers exist — don't reject, just grade as-is
      // Mark as expired so the student sees "time expired" in results
    }
  }

  // Merge final answers if provided (last-second save)
  if (finalAnswers && finalAnswers.length > 0) {
    for (const fa of finalAnswers) {
      const idx = attemptObj.answers.findIndex((a) => a.questionId === fa.questionId);
      if (idx >= 0) {
        attemptObj.answers[idx].selectedOptionId = fa.selectedOptionId ?? null;
      } else {
        attemptObj.answers.push({
          questionId: fa.questionId,
          selectedOptionId: fa.selectedOptionId ?? null,
        });
      }
    }
  }

  // Grade each question
  let totalMarks = 0;
  let scoredMarks = 0;
  const gradedAnswers: Array<{
    questionId: string;
    selectedOptionId: string | null;
    isCorrect: boolean;
    marksAwarded: number;
  }> = [];

  for (const qId of attemptObj.questionOrder) {
    const question = quiz.questions.find((q) => q.questionId === qId);
    if (!question) continue;

    totalMarks += question.marks;
    const studentAnswer = attemptObj.answers.find((a) => a.questionId === qId);
    const selectedOptionId = studentAnswer?.selectedOptionId ?? null;

    const correctOption = question.options.find((o) => o.isCorrect);
    const isCorrect = !!(selectedOptionId && correctOption && selectedOptionId === correctOption.optionId);
    const marksAwarded = isCorrect ? question.marks : 0;
    scoredMarks += marksAwarded;

    gradedAnswers.push({ questionId: qId, selectedOptionId, isCorrect, marksAwarded });
  }

  const scorePercent = totalMarks > 0 ? Math.round((scoredMarks / totalMarks) * 100) : 0;
  const passed = scorePercent >= quiz.passingScore;
  const now = new Date();
  const timeTakenSeconds = Math.round((now.getTime() - new Date(attemptObj.startedAt).getTime()) / 1000);

  // Update attempt with results
  await QuizAttemptModel.updateOne(
    { _id: attemptObj._id },
    {
      $set: {
        status: QUIZ_ATTEMPT_STATUS.COMPLETED,
        answers: gradedAnswers,
        totalMarks,
        scoredMarks,
        scorePercent,
        passed,
        timeTakenSeconds,
        completedAt: now,
      },
    }
  ).exec();

  // ── Mark chapter quiz complete on first pass ──────────────────────────
  if (passed && attemptObj.chapterOrder !== undefined) {
    await markQuizPartComplete(
      studentId,
      attemptObj.batchId,
      attemptObj.courseId,
      attemptObj.chapterOrder
    );
  }

  // ── Milestone quiz: trigger milestone recalculation ───────────────────
  if (passed && attemptObj.milestoneId) {
    try {
      const { recalculateMilestoneProgressAfterQuiz } = await import("./learningPlan.service.js");
      await recalculateMilestoneProgressAfterQuiz(
        studentId,
        attemptObj.batchId,
        attemptObj.courseId,
        attemptObj.milestoneId
      );
    } catch (err) {
      console.error(
        `[MILESTONE_QUIZ_RECALC_FAILED] studentId=${studentId} milestoneId=${attemptObj.milestoneId}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Build result with explanations
  const resultQuestions = attemptObj.questionOrder.map((qId) => {
    const question = quiz.questions.find((q) => q.questionId === qId);
    const graded = gradedAnswers.find((g) => g.questionId === qId);
    if (!question || !graded) return null;
    const correctOption = question.options.find((o) => o.isCorrect);
    return {
      questionId: question.questionId,
      text: question.text,
      imageUrl: question.imageUrl,
      marks: question.marks,
      studentAnswer: graded.selectedOptionId,
      correctAnswer: correctOption?.optionId ?? null,
      isCorrect: graded.isCorrect,
      marksAwarded: graded.marksAwarded,
      explanation: question.explanation ?? "",
      options: question.options.map((o) => ({
        optionId: o.optionId,
        text: o.text,
        imageUrl: o.imageUrl,
        isCorrect: o.isCorrect,
      })),
    };
  }).filter(Boolean);

  return {
    attemptId: attemptObj.attemptId ?? String(attemptObj._id),
    attemptNumber: attemptObj.attemptNumber,
    status: QUIZ_ATTEMPT_STATUS.COMPLETED,
    totalMarks,
    scoredMarks,
    scorePercent,
    passed,
    passingScore: quiz.passingScore,
    timeTakenSeconds,
    completedAt: now,
    questions: resultQuestions,
  };
}

// ─── Mark quiz part complete in ChapterProgress ───────────────────────────────

async function markQuizPartComplete(
  studentId: string,
  batchId: string,
  courseId: string,
  chapterOrder: number
): Promise<void> {
  const filter = { studentId, batchId, courseId, moduleOrder: chapterOrder };
  const existing = await ChapterProgressModel.findOne(filter).lean().exec();

  // Only mark on first pass — subsequent attempts don't reset completion
  if ((existing as { quizCompletedAt?: Date } | null)?.quizCompletedAt) {
    return;
  }

  const now = new Date();
  await ChapterProgressModel.findOneAndUpdate(
    filter,
    {
      $set: {
        studentId,
        batchId,
        courseId,
        moduleOrder: chapterOrder,
        quizCompletedAt: now,
        completedBy: studentId,
        isManualOverride: false,
      },
    },
    { upsert: true }
  ).exec();

  // Now check if the full chapter is complete (all parts done)
  // We import lazily to avoid circular deps — this service is lightweight
  const { checkAndCompleteChapterAfterQuiz } = await import("./studentCourse.service.js");
  await checkAndCompleteChapterAfterQuiz(studentId, batchId, courseId, chapterOrder);
}

// ─── Student: Get Attempt History ─────────────────────────────────────────────

export async function getQuizAttempts(
  studentId: string,
  quizId: string,
  batchId: string,
  courseId: string
): Promise<unknown[]> {
  const quiz = await findQuizByParam(quizId);
  if (!quiz) throw new AppError("Quiz not found", 404);
  const quizIdVal = quiz.quizId ?? String(quiz._id);

  const attempts = await QuizAttemptModel.find({
    studentId,
    quizId: quizIdVal,
    batchId,
    courseId,
    status: QUIZ_ATTEMPT_STATUS.COMPLETED,
  })
    .sort({ attemptNumber: -1 })
    .lean()
    .exec();

  return attempts.map((a) => {
    const att = a as {
      attemptId?: string;
      _id: unknown;
      attemptNumber: number;
      scorePercent: number;
      scoredMarks: number;
      totalMarks: number;
      passed: boolean;
      timeTakenSeconds: number;
      startedAt: Date;
      completedAt?: Date;
    };
    return {
      attemptId: att.attemptId ?? String(att._id),
      attemptNumber: att.attemptNumber,
      scorePercent: att.scorePercent,
      scoredMarks: att.scoredMarks,
      totalMarks: att.totalMarks,
      passed: att.passed,
      timeTakenSeconds: att.timeTakenSeconds,
      startedAt: att.startedAt,
      completedAt: att.completedAt,
    };
  });
}

// ─── Student: Get Attempt Detail (with explanations) ──────────────────────────

export async function getQuizAttemptDetail(
  attemptIdParam: string,
  studentId: string
): Promise<unknown> {
  const attempt = await QuizAttemptModel.findOne({
    $or: [
      { attemptId: attemptIdParam },
      { _id: /^[a-f\d]{24}$/i.test(attemptIdParam) ? attemptIdParam : "000000000000000000000000" },
    ],
    studentId,
    status: QUIZ_ATTEMPT_STATUS.COMPLETED,
  }).lean().exec();

  if (!attempt) throw new AppError("Attempt not found", 404);

  const att = attempt as {
    _id: unknown;
    attemptId?: string;
    quizId: string;
    attemptNumber: number;
    questionOrder: string[];
    answers: Array<{ questionId: string; selectedOptionId?: string | null; isCorrect: boolean; marksAwarded: number }>;
    totalMarks: number;
    scoredMarks: number;
    scorePercent: number;
    passed: boolean;
    timeTakenSeconds: number;
    startedAt: Date;
    completedAt?: Date;
  };

  const quiz = await findQuizByParam(att.quizId);
  if (!quiz) throw new AppError("Quiz no longer exists", 500);

  const questions = att.questionOrder.map((qId) => {
    const question = quiz.questions.find((q) => q.questionId === qId);
    const graded = att.answers.find((g) => g.questionId === qId);
    if (!question) return null;
    const correctOption = question.options.find((o) => o.isCorrect);
    return {
      questionId: question.questionId,
      text: question.text,
      imageUrl: question.imageUrl,
      marks: question.marks,
      studentAnswer: graded?.selectedOptionId ?? null,
      correctAnswer: correctOption?.optionId ?? null,
      isCorrect: graded?.isCorrect ?? false,
      marksAwarded: graded?.marksAwarded ?? 0,
      explanation: question.explanation ?? "",
      options: question.options.map((o) => ({
        optionId: o.optionId,
        text: o.text,
        imageUrl: o.imageUrl,
        isCorrect: o.isCorrect,
      })),
    };
  }).filter(Boolean);

  return {
    attemptId: att.attemptId ?? String(att._id),
    attemptNumber: att.attemptNumber,
    totalMarks: att.totalMarks,
    scoredMarks: att.scoredMarks,
    scorePercent: att.scorePercent,
    passed: att.passed,
    passingScore: quiz.passingScore,
    timeTakenSeconds: att.timeTakenSeconds,
    startedAt: att.startedAt,
    completedAt: att.completedAt,
    questions,
  };
}

// ─── Check if student has passed a quiz ───────────────────────────────────────

export async function hasStudentPassedQuiz(
  studentId: string,
  quizId: string,
  batchId: string,
  courseId: string,
  chapterOrder?: number,
  milestoneId?: string
): Promise<boolean> {
  const quiz = await findQuizByParam(quizId);
  if (!quiz) return false;
  const quizIdVal = quiz.quizId ?? String(quiz._id);

  const passed = await QuizAttemptModel.exists({
    studentId,
    quizId: quizIdVal,
    batchId,
    courseId,
    passed: true,
    status: QUIZ_ATTEMPT_STATUS.COMPLETED,
    ...(chapterOrder !== undefined ? { chapterOrder } : {}),
    ...(milestoneId ? { milestoneId } : {}),
  }).exec();

  return !!passed;
}

// ─── Get quiz pass status for multiple chapters (batch query) ─────────────────

export async function getChapterQuizStatuses(
  studentId: string,
  batchId: string,
  courseId: string,
  chapterOrders: number[]
): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  if (chapterOrders.length === 0) return result;

  const passedAttempts = await QuizAttemptModel.find({
    studentId,
    batchId,
    courseId,
    chapterOrder: { $in: chapterOrders },
    passed: true,
    status: QUIZ_ATTEMPT_STATUS.COMPLETED,
  })
    .select("chapterOrder")
    .lean()
    .exec();

  const passedSet = new Set(
    passedAttempts.map((a) => (a as { chapterOrder: number }).chapterOrder)
  );

  for (const order of chapterOrders) {
    result.set(order, passedSet.has(order));
  }
  return result;
}
