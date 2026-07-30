/**
 * Chapter Notes Service
 * Students can save personal notes per chapter, searchable across all their courses.
 */

import { ChapterNoteModel } from "../models/ChapterNote.model.js";
import { AppError } from "../utils/AppError.js";

export async function upsertNote(input: {
  studentId: string;
  batchId: string;
  courseId: string;
  chapterOrder: number;
  content: string;
}): Promise<{ id: string; content: string; updatedAt: Date }> {
  const { studentId, batchId, courseId, chapterOrder, content } = input;

  if (!content.trim()) {
    // Empty content = delete the note
    await ChapterNoteModel.deleteOne({ studentId, batchId, courseId, chapterOrder }).exec();
    return { id: "", content: "", updatedAt: new Date() };
  }

  if (content.length > 10000) {
    throw new AppError("Note is too long (max 10,000 characters)", 400);
  }

  const doc = await ChapterNoteModel.findOneAndUpdate(
    { studentId, batchId, courseId, chapterOrder },
    { $set: { content: content.trim(), studentId, batchId, courseId, chapterOrder } },
    { upsert: true, new: true }
  ).exec();

  return {
    id: String(doc._id),
    content: doc.content,
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
  };
}

export async function getNote(
  studentId: string,
  batchId: string,
  courseId: string,
  chapterOrder: number
): Promise<{ id: string; content: string; updatedAt: Date } | null> {
  const doc = await ChapterNoteModel.findOne({ studentId, batchId, courseId, chapterOrder }).lean().exec();
  if (!doc) return null;
  return {
    id: String(doc._id),
    content: doc.content,
    updatedAt: (doc as { updatedAt: Date }).updatedAt,
  };
}

export async function getAllNotes(
  studentId: string,
  options?: { search?: string; limit?: number }
): Promise<Array<{
  id: string;
  batchId: string;
  courseId: string;
  chapterOrder: number;
  content: string;
  updatedAt: Date;
}>> {
  const query: Record<string, unknown> = { studentId };

  if (options?.search?.trim()) {
    const term = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.content = { $regex: term, $options: "i" };
  }

  const limit = Math.min(200, Math.max(1, options?.limit ?? 50));

  const docs = await ChapterNoteModel.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((d) => ({
    id: String(d._id),
    batchId: d.batchId,
    courseId: d.courseId,
    chapterOrder: d.chapterOrder,
    content: d.content,
    updatedAt: (d as { updatedAt: Date }).updatedAt,
  }));
}

export async function deleteNote(
  studentId: string,
  batchId: string,
  courseId: string,
  chapterOrder: number
): Promise<void> {
  await ChapterNoteModel.deleteOne({ studentId, batchId, courseId, chapterOrder }).exec();
}
