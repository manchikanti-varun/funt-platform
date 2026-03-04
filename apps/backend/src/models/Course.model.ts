/**
 * Course model – snapshot-based. modules are snapshot copies, not refs to GlobalModule.
 */

import mongoose, { Schema } from "mongoose";
import { COURSE_STATUS } from "@funt-platform/constants";

const courseModuleSnapshotSchema = new Schema(
  {
    originalGlobalModuleId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: true },
    youtubeUrl: { type: String, required: false },
    videoUrl: { type: String, required: false },
    /** Optional link to other resources (e.g. Drive, slides, docs). */
    resourceLinkUrl: { type: String, required: false },
    versionAtSnapshot: { type: Number, required: true },
    linkedAssignmentId: { type: String, required: false },
    /** Override assignment title for this course only (does not change global assignment). */
    linkedAssignmentTitleOverride: { type: String, required: false },
    /** Override assignment instructions for this course only (does not change global assignment). */
    linkedAssignmentInstructionsOverride: { type: String, required: false },
    /** Override assignment submission type for this course only. */
    linkedAssignmentSubmissionTypeOverride: { type: String, required: false },
    /** Override assignment skill tags for this course only. */
    linkedAssignmentSkillTagsOverride: { type: [String], required: false },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const courseSchema = new Schema(
  {
    /** Unique human-readable course ID (e.g. CRS-26-00001). Generated at creation. */
    courseId: { type: String, required: false, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    modules: {
      type: [courseModuleSnapshotSchema],
      required: true,
      default: [],
    },
    version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      required: true,
      enum: [...Object.values(COURSE_STATUS), "DRAFT", "PUBLISHED"],
      default: COURSE_STATUS.ACTIVE,
    },
    createdBy: { type: String, required: true },
    /** Admin user IDs who can edit/duplicate this course (read-only admins are not listed). */
    moderatorIds: { type: [String], required: false, default: [] },
  },
  { timestamps: true }
);

export const CourseModel = mongoose.model("Course", courseSchema);
