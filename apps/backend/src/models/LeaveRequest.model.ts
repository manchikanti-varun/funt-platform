import mongoose, { Schema } from "mongoose";
import { LEAVE_TYPE, LEAVE_STATUS, ROLE } from "@funt-platform/constants";

const leaveRequestSchema = new Schema(
  {
    requestedBy: { type: String, required: true },       // userId string
    requestedByRole: {
      type: String,
      required: true,
      enum: [ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN],
    },
    leaveType: {
      type: String,
      required: true,
      enum: [...Object.values(LEAVE_TYPE), "CUSTOM"] as string[],
    },
    customLeaveType: { type: String, required: false },  // when leaveType === "CUSTOM"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    isHalfDay: { type: Boolean, required: true, default: false },
    reason: { type: String, required: true, maxlength: 2000 },
    attachment: { type: String, required: false },       // URL / S3 key

    status: {
      type: String,
      required: true,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
    },

    reviewedBy: { type: String, required: false },
    reviewedAt: { type: Date, required: false },
    reviewRemarks: { type: String, required: false, maxlength: 1000 },

    cancelledAt: { type: Date, required: false },

    // Trainer-specific
    affectedBatches: { type: [String], required: false, default: [] },
    substituteTrainerId: { type: String, required: false },
    leaveImpactNotes: { type: String, required: false, maxlength: 2000 },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ requestedBy: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1, requestedByRole: 1 });

export const LeaveRequestModel = mongoose.model("LeaveRequest", leaveRequestSchema);
