import mongoose, { Schema } from "mongoose";

const oauthNonceSchema = new Schema(
  {
    nonce: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

oauthNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthNonceModel = mongoose.model("OAuthNonce", oauthNonceSchema);
