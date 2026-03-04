
import mongoose, { Schema } from "mongoose";
import { BADGE_TYPE } from "@funt-platform/constants";

const achievementSchema = new Schema(
  {
    studentId: { type: String, required: true },
    badgeType: {
      type: String,
      required: true,
      enum: Object.values(BADGE_TYPE),
    },
    awardedAt: { type: Date, required: true, default: Date.now },
    meta: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: false }
);

achievementSchema.index({ studentId: 1, badgeType: 1 }, { unique: true });

export const AchievementModel = mongoose.model("Achievement", achievementSchema);
