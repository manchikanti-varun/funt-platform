import mongoose, { Schema } from "mongoose";

const GRANT_SOURCES = ["CERTIFICATE_GRANT", "BATCH_COMPLETION", "LEGACY_SYNC", "ADMIN_ADJUST"] as const;

const coinGrantSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    amountOriginal: { type: Number, required: true, min: 0 },
    amountRemaining: { type: Number, required: true, min: 0 },
    grantedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    source: { type: String, required: true, enum: GRANT_SOURCES },
    sourceRef: { type: String, required: false },
  },
  { timestamps: false }
);

coinGrantSchema.index({ userId: 1, expiresAt: 1 });
coinGrantSchema.index({ expiresAt: 1 });

export const CoinGrantModel = mongoose.model("CoinGrant", coinGrantSchema);
