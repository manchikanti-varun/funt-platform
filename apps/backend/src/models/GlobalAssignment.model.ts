
import mongoose, { Schema } from "mongoose";
import {
  ASSIGNMENT_STATUS,
  SUBMISSION_TYPE,
  SKILL_TAG,
} from "@funt-platform/constants";

const globalAssignmentSchema = new Schema(
  {
        assignmentId: { type: String, required: false, unique: true, sparse: true },
    title: { type: String, required: true },
    instructions: { type: String, required: true },
    submissionType: {
      type: String,
      required: true,
      enum: Object.values(SUBMISSION_TYPE),
    },
    skillTags: {
      type: [String],
      required: true,
      enum: Object.values(SKILL_TAG),
    },
    status: {
      type: String,
      required: true,
      enum: [...Object.values(ASSIGNMENT_STATUS), "DRAFT", "PUBLISHED", "DUE", "CLOSED"],
      default: ASSIGNMENT_STATUS.ACTIVE,
    },
        type: { type: String, required: true, enum: ["general", "module"], default: "module" },
        allowedStudentIds: { type: [String], required: false, default: [] },
    createdBy: { type: String, required: true },
        moderatorIds: { type: [String], required: false, default: [] },
  },
  { timestamps: true }
);

export const GlobalAssignmentModel = mongoose.model(
  "GlobalAssignment",
  globalAssignmentSchema
);
