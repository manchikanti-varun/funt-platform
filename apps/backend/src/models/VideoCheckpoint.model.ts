import mongoose, { Schema } from "mongoose";

/**
 * VideoCheckpoint — stores interactive checkpoint questions for R2-hosted videos.
 *
 * Supported question types:
 *   - mcq: Multiple choice (single correct answer)
 *   - true_false: True/False
 *   - multi_select: Select all that apply (multiple correct)
 *   - fill_blank: Type a keyword/phrase
 *   - code_output: Show code snippet, ask what it prints
 */

const checkpointOptionSchema = new Schema(
  {
    optionId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { _id: false }
);

const videoCheckpointSchema = new Schema(
  {
    /** The GlobalModule._id that owns this checkpoint (the chapter with the video) */
    moduleId: { type: String, required: true, index: true },

    /** The r2:// video key at the time of creation (for cross-reference / validation) */
    videoKey: { type: String, required: true },

    /** Timestamp (in seconds) when the question should appear */
    questionTimestamp: { type: Number, required: true, min: 0 },

    /** Timestamp (in seconds) where the video jumps on incorrect answer */
    reviewTimestamp: { type: Number, required: true, min: 0 },

    /** The question text */
    question: { type: String, required: true, maxlength: 1000 },

    /** Question type */
    type: {
      type: String,
      required: true,
      enum: ["mcq", "true_false", "multi_select", "fill_blank", "code_output"],
      default: "mcq",
    },

    /** Answer options (for mcq, true_false, multi_select) */
    options: { type: [checkpointOptionSchema], required: false, default: [] },

    /** The optionId of the correct answer (mcq, true_false) */
    correctOptionId: { type: String, required: false },

    /** Array of correct optionIds (multi_select) */
    correctOptionIds: { type: [String], required: false, default: [] },

    /** Correct text answer for fill_blank / code_output (case-insensitive match) */
    correctText: { type: String, required: false },

    /** Acceptable alternative answers for fill_blank (all case-insensitive) */
    acceptableAnswers: { type: [String], required: false, default: [] },

    /** Code snippet shown for code_output questions */
    codeSnippet: { type: String, required: false, maxlength: 2000 },

    /** Programming language hint for code_output syntax highlighting */
    codeLanguage: { type: String, required: false, default: "" },

    /** Optional explanation shown after answering */
    explanation: { type: String, required: false, default: "" },

    /** Soft-disable without deletion */
    isActive: { type: Boolean, required: true, default: true },

    /** Display order (lower = earlier in timeline) */
    order: { type: Number, required: false, default: 0 },

    /** XP bonus for first-attempt correct answer (gamification) */
    bonusXp: { type: Number, required: false, default: 5, min: 0, max: 100 },

    /** Who created this checkpoint */
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
videoCheckpointSchema.index({ moduleId: 1, questionTimestamp: 1 });

export const VideoCheckpointModel = mongoose.model("VideoCheckpoint", videoCheckpointSchema);
