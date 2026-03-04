/**
 * General (event) attendance – not tied to a batch.
 * One document per event: date, optional title, list of present student IDs.
 */

import mongoose, { Schema } from "mongoose";

const generalAttendanceSchema = new Schema(
  {
    eventDate: { type: Date, required: true },
    title: { type: String, required: false },
    markedBy: { type: String, required: true },
    presentStudentIds: { type: [String], required: true, default: [] },
  },
  { timestamps: true }
);

generalAttendanceSchema.index({ eventDate: -1 });

export const GeneralAttendanceModel = mongoose.model("GeneralAttendance", generalAttendanceSchema);
