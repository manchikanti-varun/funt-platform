/**
 * GlobalAssignment Mongoose model – aligned with shared GlobalAssignment type.
 */

import mongoose, { Schema } from "mongoose";
import {
  ASSIGNMENT_STATUS,
  SUBMISSION_TYPE,
  SKILL_TAG,
} from "@funt-platform/constants";

const globalAssignmentSchema = new Schema(
  {
    /** Unique human-readable assignment ID (e.g. ASG-26-00001). Generated at creation. */
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
    /** general = in-class / standalone, access via allowedStudentIds; module = linked inside modules only */
    type: { type: String, required: true, enum: ["general", "module"], default: "module" },
    /** For type=general: student user IDs who can see and submit this assignment. Empty = no one. */
    allowedStudentIds: { type: [String], required: false, default: [] },
    createdBy: { type: String, required: true },
    /** Admin/trainer user IDs who can edit and manage access (same as creator). Others read-only. */
    moderatorIds: { type: [String], required: false, default: [] },
  },
  { timestamps: true }
);

export const GlobalAssignmentModel = mongoose.model(
  "GlobalAssignment",
  globalAssignmentSchema
);
