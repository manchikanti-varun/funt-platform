import mongoose, { Schema } from "mongoose";

const SHOP_SHELF = ["KITS", "COMPONENTS"] as const;

const shopProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    shopShelf: { type: String, required: true, enum: SHOP_SHELF, default: "KITS" },
    description: { type: String, required: false, default: "" },
    priceCoins: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: false, default: "" },
    active: { type: Boolean, required: true, default: true },
    stock: { type: Number, required: false, default: null },
    sortOrder: { type: Number, required: false, default: 0 },
  },
  { timestamps: true }
);

shopProductSchema.index({ active: 1, sortOrder: 1 });

export const ShopProductModel = mongoose.model("ShopProduct", shopProductSchema);
