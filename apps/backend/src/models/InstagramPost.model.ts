import mongoose, { Schema } from "mongoose";

const instagramPostSchema = new Schema(
  {
    /** Instagram post URL (e.g. https://www.instagram.com/p/SHORTCODE/) */
    postUrl: { type: String, required: true, unique: true },
    /** Optional label/caption for admin reference */
    label: { type: String, required: false, default: "" },
    /** Display order (lower = shown first) */
    order: { type: Number, required: false, default: 0 },
    /** Whether this post is active (shown on website) */
    active: { type: Boolean, required: true, default: true },
    /** Who added this post */
    addedBy: { type: String, required: true },
  },
  { timestamps: true }
);

instagramPostSchema.index({ active: 1, order: 1 });

export const InstagramPostModel = mongoose.model("InstagramPost", instagramPostSchema);
