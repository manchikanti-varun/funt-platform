
import mongoose, { Schema } from "mongoose";
import {
  COURSE_STATUS,
  COURSE_DELIVERY_MODE,
  MILESTONE_UNLOCK_TYPE,
  MILESTONE_COMPLETION_RULE,
} from "@funt-platform/constants";

// ─── Milestone sub-schema ─────────────────────────────────────────────────────
const milestoneSchema = new Schema(
  {
    milestoneId:          { type: String, required: true },   // stable cuid/uuid — never reorder
    title:                { type: String, required: true, maxlength: 200 },
    description:          { type: String, required: false, default: "" },
    order:                { type: Number, required: true },   // display only — not a FK
    feeInPaise:           { type: Number, required: true, default: 0, min: 0 },
    unlockType:           {
      type: String,
      required: true,
      enum: Object.values(MILESTONE_UNLOCK_TYPE),
      default: MILESTONE_UNLOCK_TYPE.PAYMENT_AFTER_COMPLETION,
    },
    completionRule:       {
      type: String,
      required: true,
      enum: Object.values(MILESTONE_COMPLETION_RULE),
      default: MILESTONE_COMPLETION_RULE.COMPLETE_ALL_CHAPTERS,
    },
    unlockAfterDate:      { type: Date,   required: false },
    unlockAfterDays:      { type: Number, required: false, min: 0 },  // relative to enrolledAt
    paymentDueInDays:     { type: Number, required: false, min: 0 },  // days after eligibility to pay
    certificateEligible:  { type: Boolean, required: true, default: false },
    active:               { type: Boolean, required: true, default: true },
    /** Chapter orders (moduleOrder values) that belong to this milestone */
    chapterOrders:        { type: [Number], required: true, default: [] },
  },
  { _id: false }
);

// ─── LearningPlan sub-schema ──────────────────────────────────────────────────
const learningPlanSchema = new Schema(
  {
    enabled:                    { type: Boolean, required: true, default: false },
    autoLockPreviousMilestones: { type: Boolean, required: true, default: false },
    milestones:                 { type: [milestoneSchema], required: true, default: [] },
  },
  { _id: false }
);

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
    /** XP granted when the student fully completes this module (default matches legacy fixed award). */
    xpReward: { type: Number, required: false, default: 40, min: 0, max: 100_000 },
  },
  { _id: false }
);

const courseSchema = new Schema(
  {
        courseId: { type: String, required: false, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    /** Course card banner image (required when creating/updating via API). */
    headerImageUrl: { type: String, required: false },
    /** Demo courses are free and included in batches with auto-enroll-all-students. */
    isDemo: { type: Boolean, required: false, default: false },
    durationText: { type: String, required: false, default: "" },
    /** Marketing/catalog fields — shown on explore pages and marketing website */
    ageGroup: { type: String, required: false, default: "" },
    certification: { type: String, required: false, default: "Certification upon completion" },
    paymentNote: { type: String, required: false, default: "" },
    /** What students learn — array of short bullet points */
    learningOutcomes: { type: [String], required: false, default: [] },
    /** Course overview / detailed description (rich text) */
    overview: { type: String, required: false, default: "" },
    /** Pricing tiers: [{label, price, note}] shown on explore page */
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
    /**
     * Per-course watermark override.
     * null / undefined = inherit global LMS policy
     * true = watermark ON for this course regardless of global
     * false = watermark OFF for this course regardless of global
     */
    enableWatermark: { type: Boolean, required: false, default: null },

    // ── Learning Plan ──────────────────────────────────────────────────
    deliveryMode: {
      type: String,
      required: true,
      enum: Object.values(COURSE_DELIVERY_MODE),
      default: COURSE_DELIVERY_MODE.FULL_ACCESS,
    },
    learningPlan: {
      type: learningPlanSchema,
      required: false,
      default: () => ({ enabled: false, autoLockPreviousMilestones: false, milestones: [] }),
    },
  },
  { timestamps: true }
);

courseSchema.pre("validate", function (next) {
  const doc = this as { modules?: unknown[]; chapters?: unknown[] };
  if ((!Array.isArray(doc.modules) || doc.modules.length === 0) && Array.isArray(doc.chapters)) {
    doc.modules = doc.chapters;
  }
  next();
});

courseSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: { modules?: unknown[]; chapters?: unknown[] }) => {
    if (!Array.isArray(ret.chapters)) ret.chapters = Array.isArray(ret.modules) ? ret.modules : [];
    return ret;
  },
});

export const CourseModel = mongoose.model("Course", courseSchema);
