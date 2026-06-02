
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
    /** XP granted when the student fully completes this module in a batch (snapshot value at batch creation). */
    xpReward: { type: Number, required: false, default: 40, min: 0, max: 100_000 },
  },
  { _id: false }
);

const courseSnapshotSchema = new Schema(
  {
    courseId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    /** Optional course-level header image (copied from source course when batch is created). */
    headerImageUrl: { type: String, required: false },
    durationText: { type: String, required: false, default: "" },
    /** Marketing/catalog fields */
    ageGroup: { type: String, required: false, default: "" },
    certification: { type: String, required: false, default: "" },
    paymentNote: { type: String, required: false, default: "" },
    learningOutcomes: { type: [String], required: false, default: [] },
    overview: { type: String, required: false, default: "" },
    pricingTiers: {
      type: [{
        label: { type: String, required: true },
        price: { type: String, required: true },
        note: { type: String, required: false, default: "" },
        _id: false,
      }],
      required: false,
      default: [],
    },
    modules: { type: [courseModuleSnapshotSchema], required: true, default: [] },
    version: { type: Number, required: true },
    /** INR enrollment list price for this course in this batch (paise). Shown at checkout; Razorpay order uses this amount. */
    enrollmentPriceInPaise: { type: Number, required: false, default: 0, min: 0 },
    /** How students may pay for this course in this batch: UPI_MANUAL, RAZORPAY, or both. Empty when no paid checkout. */
    allowedPaymentMethods: { type: [String], required: false, default: undefined },
    /** FUNT coins auto-credited when a student earns a certificate for this course in this batch (same cohort as fee). */
    completionRewardCoins: { type: Number, required: false, default: 0, min: 0 },
    /** Badge keys auto-awarded when certificate is issued for this course in this batch. */
    completionBadgeTypes: { type: [String], required: false, default: [] },
    /** Copied from source course: shown as free demo in student UI. */
    isDemo: { type: Boolean, required: false, default: false },
  },
  { _id: false }
);

courseSnapshotSchema.pre("validate", function (next) {
  const snap = this as { modules?: unknown[]; chapters?: unknown[] };
  if ((!Array.isArray(snap.modules) || snap.modules.length === 0) && Array.isArray(snap.chapters)) {
    snap.modules = snap.chapters;
  }
  next();
});

courseSnapshotSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: { modules?: unknown[]; chapters?: unknown[] }) => {
    if (!Array.isArray(ret.chapters)) ret.chapters = Array.isArray(ret.modules) ? ret.modules : [];
    return ret;
  },
});

const batchSchema = new Schema(
  {
        batchId: { type: String, required: false, unique: true, sparse: true },
    name: { type: String, required: true },
        courseSnapshots: { type: [courseSnapshotSchema], required: false, default: undefined },
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
        createdBy: { type: String, required: false },
        moderatorIds: { type: [String], required: false, default: [] },
    /** FUNT coins students pay (when eligible) to generate their certificate; 0 = free. */
    certificatePriceCoins: { type: Number, required: false, default: 0, min: 0 },
    /** Manual UPI QR for this batch: https image URL or data:image/...;base64,... (shown at student checkout when UPI manual is enabled). */
    manualUpiQrUrl: { type: String, required: false },
    /** Legacy batch-level banner (prefer course.headerImageUrl). */
    headerImageUrl: { type: String, required: false },
    visibility: {
      type: String,
      required: true,
      enum: ["PUBLIC", "PRIVATE"],
      default: "PUBLIC",
    },
    /** When true, every active student is auto-enrolled in this batch (use for free demo courses; set fees to ₹0). */
    autoEnrollAllStudents: { type: Boolean, required: false, default: false },
  },
  { timestamps: true }
);

export const BatchModel = mongoose.model("Batch", batchSchema);
