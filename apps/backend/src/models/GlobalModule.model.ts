
import mongoose, { Schema } from "mongoose";
import { MODULE_STATUS } from "@funt-platform/constants";

const versionSnapshotSchema = new Schema(
  {
    version: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: false, default: "" },
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
    // Optional: a chapter may have only a YouTube/video URL, a resource link,
    // or a linked assignment with no body text. The service-level validator
    // enforces "at least one of content / media / assignment".
    content: { type: String, required: false, default: "" },
    youtubeUrl: { type: String, required: false },
    videoUrl: { type: String, required: false },
    resourceLinkUrl: { type: String, required: false },
    /** Downloadable file attachments — array of { fileKey, filename, size, mimeType } */
    downloadableFiles: {
      type: [{
        fileKey: { type: String, required: true },
        filename: { type: String, required: true },
        size: { type: Number, required: false },
        mimeType: { type: String, required: false },
        _id: false,
      }],
      required: false,
      default: [],
    },
    version: { type: Number, required: true, default: 1 },
    linkedAssignmentId: { type: String, required: false },
    linkedQuizId: { type: String, required: false },
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
