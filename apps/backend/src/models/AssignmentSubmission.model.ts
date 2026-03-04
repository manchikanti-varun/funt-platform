
import mongoose, { Schema } from "mongoose";
import { SUBMISSION_TYPE, SUBMISSION_REVIEW_STATUS } from "@funt-platform/constants";

const assignmentSubmissionSchema = new Schema(
  {
        submissionId: { type: String, required: false, unique: true, sparse: true },
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
        courseId: { type: String, required: false },
    moduleOrder: { type: Number, required: true },
    assignmentId: { type: String, required: true },
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
    rating: { type: Number, required: false },
    submittedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date, required: false },
    reviewedBy: { type: String, required: false },
  },
  { timestamps: true }
);

assignmentSubmissionSchema.index({ studentId: 1, batchId: 1, courseId: 1, moduleOrder: 1 });

export const AssignmentSubmissionModel = mongoose.model(
  "AssignmentSubmission",
  assignmentSubmissionSchema
);
