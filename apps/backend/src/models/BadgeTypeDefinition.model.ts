
import mongoose, { Schema } from "mongoose";

const badgeTypeDefinitionSchema = new Schema(
  {
    badgeType: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    icon: { type: String, required: true }, 
  },
  { timestamps: true }
);

export const BadgeTypeDefinitionModel = mongoose.model("BadgeTypeDefinition", badgeTypeDefinitionSchema);
