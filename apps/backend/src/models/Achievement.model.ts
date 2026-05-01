
import mongoose, { Schema } from "mongoose";

const achievementSchema = new Schema(
  {
    studentId: { type: String, required: true },
    badgeType: { type: String, required: true },
    awardedAt: { type: Date, required: true, default: Date.now },
    meta: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: false }
);

achievementSchema.index({ studentId: 1, badgeType: 1 }, { unique: true });

export const AchievementModel = mongoose.model("Achievement", achievementSchema);
