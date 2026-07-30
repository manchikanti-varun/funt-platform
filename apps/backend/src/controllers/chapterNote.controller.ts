import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { successRes } from "../utils/response.js";
import * as noteService from "../services/chapterNote.service.js";

function getUserId(req: Request): string {
  if (!req.user?.userId) throw new AppError("Unauthorized", 401);
  return req.user.userId;
}

/** PUT /api/student/notes — save or update a chapter note */
export const saveNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId, courseId, chapterOrder, content } = req.body ?? {};
  if (!batchId || !courseId || chapterOrder == null) {
    throw new AppError("batchId, courseId, and chapterOrder are required", 400);
  }
  const data = await noteService.upsertNote({
    studentId,
    batchId: String(batchId).trim(),
    courseId: String(courseId).trim(),
    chapterOrder: Number(chapterOrder),
    content: String(content ?? ""),
  });
  successRes(res, data);
});

/** GET /api/student/notes?batchId=&courseId=&chapterOrder= — get note for a specific chapter */
export const getNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const batchId = req.query.batchId as string;
  const courseId = req.query.courseId as string;
  const chapterOrder = Number(req.query.chapterOrder);
  if (!batchId || !courseId || Number.isNaN(chapterOrder)) {
    throw new AppError("batchId, courseId, and chapterOrder are required", 400);
  }
  const data = await noteService.getNote(studentId, batchId, courseId, chapterOrder);
  successRes(res, data);
});

/** GET /api/student/notes/all?search=&limit= — search all notes for this student */
export const getAllNotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const data = await noteService.getAllNotes(studentId, { search, limit });
  successRes(res, data);
});

/** DELETE /api/student/notes — delete a note */
export const deleteNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const studentId = getUserId(req);
  const { batchId, courseId, chapterOrder } = req.body ?? {};
  if (!batchId || !courseId || chapterOrder == null) {
    throw new AppError("batchId, courseId, and chapterOrder are required", 400);
  }
  await noteService.deleteNote(studentId, String(batchId), String(courseId), Number(chapterOrder));
  successRes(res, { deleted: true });
});
