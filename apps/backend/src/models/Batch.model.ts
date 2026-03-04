/**
 * Batch model – contains full courseSnapshot copy. No reference to live Course.
 */

import mongoose, { Schema } from "mongoose";
import { BATCH_STATUS } from "@funt-platform/constants";

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

const courseSnapshotSchema = new Schema(
  {
    courseId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    modules: { type: [courseModuleSnapshotSchema], required: true, default: [] },
    version: { type: Number, required: true },
  },
  { _id: false }
);

const batchSchema = new Schema(
  {
    /** Unique human-readable batch ID (e.g. BT-26-0001), like student FUNT ID. Generated at creation. */
    batchId: { type: String, required: false, unique: true, sparse: true },
    name: { type: String, required: true },
    /** One or more course snapshots. Use this for new batches. */
    courseSnapshots: { type: [courseSnapshotSchema], required: false, default: undefined },
    /** Legacy: single course. If present, treated as courseSnapshots[0] when reading. */
    courseSnapshot: { type: courseSnapshotSchema, required: false },
    trainerId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: false },
    zoomLink: { type: String, required: false },
    status: {
      type: String,
      required: true,
      enum: [...Object.values(BATCH_STATUS), "SCHEDULED", "COMPLETED", "CANCELLED"],
      default: BATCH_STATUS.ACTIVE,
    },
    /** Admin user ID who created the batch (for enrollment requests). */
    createdBy: { type: String, required: false },
    /** Admin user IDs who can edit/duplicate this batch (read-only admins are not listed). */
    moderatorIds: { type: [String], required: false, default: [] },
  },
  { timestamps: true }
);

export const BatchModel = mongoose.model("Batch", batchSchema);
