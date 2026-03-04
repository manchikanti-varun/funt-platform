
import mongoose, { Schema } from "mongoose";
import { SUBMISSION_TYPE, SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";

const globalAssignmentSubmissionSchema = new Schema(
  {
    studentId: { type: String, required: true },
    assignmentId: { type: String, required: true },
    trainerId: { type: String, required: false, default: "" },
    submissionType: {
      type: String,
      required: true,
      enum: Object.values(SUBMISSION_TYPE),
    },
    submissionContent: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(SUBMISSION_REVIEW_STATUS),
      default: SUBMISSION_REVIEW_STATUS.PENDING,
    },
    feedback: { type: String, required: false },
    submittedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date, required: false },
    reviewedBy: { type: String, required: false },
  },
  { timestamps: true }
);

globalAssignmentSubmissionSchema.index({ studentId: 1, assignmentId: 1 });

export const GlobalAssignmentSubmissionModel = mongoose.model(
  "GlobalAssignmentSubmission",
  globalAssignmentSubmissionSchema
);
