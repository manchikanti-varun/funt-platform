import mongoose, { Schema } from "mongoose";
import { INVOICE_SOURCE, INVOICE_STATUS } from "@funt-platform/constants";

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, index: true },
    courseId: { type: String, required: false, default: "" },
    enrollmentId: { type: String, required: false, index: true, sparse: true },
    paymentSubmissionId: { type: String, required: false, index: true, sparse: true },
    source: {
      type: String,
      required: true,
      enum: Object.values(INVOICE_SOURCE),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.ISSUED,
    },
    amountInPaise: { type: Number, required: true, min: 0 },
    discountInPaise: { type: Number, required: false, default: 0, min: 0 },
    totalInPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR" },
    lineDescription: { type: String, required: true },
    lineItemType: { type: String, enum: ["SERVICE", "GOODS"], default: "SERVICE" },
    lineHsnCode: { type: String, required: false, default: "" },
    lineSacCode: { type: String, required: false, default: "" },
    studentName: { type: String, required: false, default: "" },
    studentEmail: { type: String, required: false, default: "" },
    studentPhone: { type: String, required: false, default: "" },
    studentAddress: { type: String, required: false, default: "" },
    studentUsername: { type: String, required: false, default: "" },
    batchName: { type: String, required: false, default: "" },
    courseTitle: { type: String, required: false, default: "" },
    notes: { type: String, required: false, default: "" },
    issuedAt: { type: Date, required: true, default: Date.now },
    electronicallySignedAt: { type: Date, required: false },
    documentHash: { type: String, required: false, default: "" },
    electronicSignature: { type: String, required: false, default: "" },
    createdBy: { type: String, required: true },
    /** Franchise center that this invoice is attributed to (null = parent org) */
    franchiseId: { type: String, required: false, index: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ studentId: 1, issuedAt: -1 });
invoiceSchema.index({ batchId: 1, issuedAt: -1 });

export const InvoiceModel = mongoose.model("Invoice", invoiceSchema);
