/**
 * Badge type definitions – display name and icon per badge type (stored in DB).
 */

import mongoose, { Schema } from "mongoose";

const badgeTypeDefinitionSchema = new Schema(
  {
    badgeType: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    icon: { type: String, required: true }, // e.g. "assignment", "streak", "course", "attendance", "star"
  },
  { timestamps: true }
);

export const BadgeTypeDefinitionModel = mongoose.model("BadgeTypeDefinition", badgeTypeDefinitionSchema);
