
import mongoose, { Schema } from "mongoose";

const AUTO_TRIGGERS = [
  "FIRST_ASSIGNMENT_COMPLETED",
  "FIRST_COURSE_COMPLETED",
  "FIRST_MODULE_COMPLETED",
] as const;

const badgeTypeDefinitionSchema = new Schema(
  {
    badgeType: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    icon: { type: String, required: true },
    description: { type: String, required: false, default: "" },
    imageUrl: { type: String, required: false, default: "" },
    isActive: { type: Boolean, required: true, default: true },
    awardMode: { type: String, required: true, enum: ["MANUAL", "AUTO", "BOTH"], default: "MANUAL" },
    autoTrigger: { type: String, required: false, enum: AUTO_TRIGGERS, default: undefined },
    createdBy: { type: String, required: false },
    updatedBy: { type: String, required: false },
  },
  { timestamps: true }
);

export const BadgeTypeDefinitionModel = mongoose.model("BadgeTypeDefinition", badgeTypeDefinitionSchema);
