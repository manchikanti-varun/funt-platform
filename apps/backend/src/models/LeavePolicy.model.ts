import mongoose, { Schema } from "mongoose";
import { LEAVE_TYPE } from "@funt-platform/constants";

/**
 * Singleton leave policy document (one per year or one global).
 * Super Admin can create/update it.
 */
const leavePolicySchema = new Schema(
  {
    year: { type: Number, required: true },          // e.g. 2025; use 0 for "global/default"
    annualLeaveLimit: { type: Number, required: true, default: 12 },
    leaveTypes: {
      type: [String],
      required: true,
      default: Object.values(LEAVE_TYPE),
    },
    allowHalfDay: { type: Boolean, required: true, default: true },
    maxConsecutiveLeaves: { type: Number, required: true, default: 7 },
    customLeaveTypes: { type: [String], required: false, default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

leavePolicySchema.index({ year: 1 }, { unique: true });

export const LeavePolicyModel = mongoose.model("LeavePolicy", leavePolicySchema);
