
import mongoose, { Schema } from "mongoose";
import { ATTENDANCE_STATUS } from "@funt-platform/constants";

const attendanceRecordSchema = new Schema(
  {
    studentId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ATTENDANCE_STATUS),
    },
  },
  { _id: false }
);

const attendanceSchema = new Schema(
  {
    batchId: { type: String, required: true },
    sessionDate: { type: Date, required: true },
    markedBy: { type: String, required: true },
    attendanceRecords: {
      type: [attendanceRecordSchema],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ batchId: 1, sessionDate: 1 }, { unique: true });

export const AttendanceModel = mongoose.model("Attendance", attendanceSchema);
