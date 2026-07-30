import mongoose, { Schema } from "mongoose";

const chapterNoteSchema = new Schema(
  {
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    courseId: { type: String, required: true },
    chapterOrder: { type: Number, required: true },
    content: { type: String, required: true, maxlength: 10000 },
  },
  { timestamps: true }
);

// One note per student per chapter (upsert pattern)
chapterNoteSchema.index(
  { studentId: 1, batchId: 1, courseId: 1, chapterOrder: 1 },
  { unique: true }
);
// For searching across all notes
chapterNoteSchema.index({ studentId: 1, updatedAt: -1 });

export const ChapterNoteModel = mongoose.model("ChapterNote", chapterNoteSchema);
