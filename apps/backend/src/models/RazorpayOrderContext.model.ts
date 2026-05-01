import mongoose, { Schema } from "mongoose";

const razorpayOrderContextSchema = new Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    expectedAmountPaise: { type: Number, required: true, min: 100 },
    expectedCouponCode: { type: String, required: false, uppercase: true, trim: true },
    expectedCouponId: { type: String, required: false },
    consumedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

razorpayOrderContextSchema.index({ studentId: 1, batchId: 1, courseId: 1, createdAt: -1 });

export const RazorpayOrderContextModel = mongoose.model("RazorpayOrderContext", razorpayOrderContextSchema);
