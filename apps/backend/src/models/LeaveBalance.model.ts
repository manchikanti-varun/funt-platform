import mongoose, { Schema } from "mongoose";

/**
 * Tracks leave balance per user per year.
 */
const leaveBalanceSchema = new Schema(
  {
    userId: { type: String, required: true },
    year: { type: Number, required: true },
    totalLeaves: { type: Number, required: true, default: 12 },
    usedLeaves: { type: Number, required: true, default: 0 },
    remainingLeaves: { type: Number, required: true, default: 12 },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });

export const LeaveBalanceModel = mongoose.model("LeaveBalance", leaveBalanceSchema);
