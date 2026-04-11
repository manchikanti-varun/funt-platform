import mongoose, { Schema } from "mongoose";

const licenseKeySchema = new Schema(
  {
    courseId: { type: String, required: true },
    batchId: { type: String, required: false },
    key: { type: String, required: true, unique: true },
    createdBy: { type: String, required: true },
    usedByStudentId: { type: String, required: false },
    usedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

licenseKeySchema.index({ courseId: 1 });

export const LicenseKeyModel = mongoose.model("LicenseKey", licenseKeySchema);
