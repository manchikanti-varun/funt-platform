/**
 * Counter collection for unique FUNT ID generation.
 * One document per (prefix + year) for incremental IDs.
 */

import mongoose, { Schema } from "mongoose";

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: false }
);

export const CounterModel = mongoose.model("Counter", counterSchema);
