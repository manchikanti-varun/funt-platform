
import mongoose, { Schema } from "mongoose";
import { MODULE_STATUS } from "@funt-platform/constants";

const versionSnapshotSchema = new Schema(
  {
    version: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: true },
    youtubeUrl: { type: String, required: false },
    videoUrl: { type: String, required: false },
    resourceLinkUrl: { type: String, required: false },
    linkedAssignmentId: { type: String, required: false },
    savedAt: { type: Date, required: true, default: Date.now },
    savedBy: { type: String, required: false },
  },
  { _id: false }
);

const globalModuleSchema = new Schema(
  {
        moduleId: { type: String, required: false, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: true },
    youtubeUrl: { type: String, required: false },
    videoUrl: { type: String, required: false },
    resourceLinkUrl: { type: String, required: false },
    version: { type: Number, required: true, default: 1 },
    linkedAssignmentId: { type: String, required: false },
        versionSnapshots: { type: [versionSnapshotSchema], required: true, default: [] },
    status: {
      type: String,
      required: true,
      enum: [...Object.values(MODULE_STATUS), "DRAFT", "PUBLISHED"],
      default: MODULE_STATUS.ACTIVE,
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const GlobalModuleModel = mongoose.model("GlobalModule", globalModuleSchema);
