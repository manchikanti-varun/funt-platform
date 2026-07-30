import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import * as feedbackService from "../services/trainerFeedback.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

/** POST /api/admin/feedback — trainer submits feedback for a student's chapter */
export const submitFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const trainerId = getUserId(req);
  const { studentId, batchId, courseId, chapterOrder, feedback, rating } = req.body ?? {};
  if (!studentId || !batchId || !courseId || chapterOrder == null || !feedback) {
    throw new AppError("studentId, batchId, courseId, chapterOrder, and feedback are required", 400);
  }
  const data = await feedbackService.upsertFeedback({
    studentId, batchId, courseId,
    chapterOrder: Number(chapterOrder),
    trainerId,
    feedback: String(feedback),
    rating: rating != null ? Number(rating) : undefined,
  });
  successRes(res, data, "Feedback saved");
});

/** GET /api/admin/feedback?studentId=&batchId=&courseId= — trainer views their feedback */
export const getTrainerFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const trainerId = getUserId(req);
  const { studentId, batchId, courseId } = req.query as Record<string, string>;
  if (!studentId || !batchId || !courseId) {
    throw new AppError("studentId, batchId, and courseId are required", 400);
  }
  const data = await feedbackService.getFeedbackByTrainer(trainerId, studentId, batchId, courseId);
  successRes(res, data);
});

/** DELETE /api/admin/feedback/:id — trainer deletes their feedback */
export const removeFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const trainerId = getUserId(req);
  const id = req.params.id;
  if (!id) throw new AppError("Feedback ID required", 400);
  const data = await feedbackService.deleteFeedback(trainerId, id);
  successRes(res, data);
});

/** GET /api/student/feedback?batchId=&courseId= — student views feedback they received */
export const getMyFeedback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId, courseId } = req.query as Record<string, string>;
  if (!batchId || !courseId) throw new AppError("batchId and courseId are required", 400);
  const data = await feedbackService.getFeedbackForStudent(studentId, batchId, courseId);
  successRes(res, data);
});
