
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
        resourceLinkUrl: { type: String, required: false },
    versionAtSnapshot: { type: Number, required: true },
    linkedAssignmentId: { type: String, required: false },
        linkedAssignmentTitleOverride: { type: String, required: false },
        linkedAssignmentInstructionsOverride: { type: String, required: false },
        linkedAssignmentSubmissionTypeOverride: { type: String, required: false },
        linkedAssignmentSkillTagsOverride: { type: [String], required: false },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const courseSchema = new Schema(
  {
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
        moderatorIds: { type: [String], required: false, default: [] },
  },
  { timestamps: true }
);

export const CourseModel = mongoose.model("Course", courseSchema);
