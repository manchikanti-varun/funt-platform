import mongoose, { Schema } from "mongoose";

/**
 * FranchiseKeyPool — tracks how many license keys a franchise owns per course.
 *
 * When parent allocates keys to a franchise, `totalAllocated` increases.
 * When franchise enrolls a student (assigns a key), `totalUsed` increases.
 * Available keys = totalAllocated - totalUsed.
 */
const franchiseKeyPoolSchema = new Schema(
  {
    franchiseId: { type: String, required: true },
    courseId: { type: String, required: true },
    /** Total keys ever allocated by parent to this franchise for this course */
    totalAllocated: { type: Number, required: true, default: 0, min: 0 },
    /** Total keys consumed (assigned to students) */
    totalUsed: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

franchiseKeyPoolSchema.index({ franchiseId: 1, courseId: 1 }, { unique: true });

export const FranchiseKeyPoolModel = mongoose.model("FranchiseKeyPool", franchiseKeyPoolSchema);

/**
 * FranchiseKeyRequest — franchise requests to buy more keys from parent.
 *
 * Status flow: PENDING → APPROVED / REJECTED
 * When approved, parent specifies how many keys to allocate → pool is updated.
 */
const franchiseKeyRequestSchema = new Schema(
  {
    franchiseId: { type: String, required: true, index: true },
    courseId: { type: String, required: true },
    /** How many keys the franchise is requesting */
    requestedCount: { type: Number, required: true, min: 1 },
    /** Payment proof (URL to uploaded screenshot/receipt) */
    paymentProofUrl: { type: String, required: false, default: "" },
    /** Note from franchise (e.g., "Paid ₹50,000 via NEFT, ref: ABC123") */
    note: { type: String, required: false, default: "" },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    /** How many keys were actually allocated (may differ from requested) */
    allocatedCount: { type: Number, required: false, default: 0 },
    /** Rejection reason */
    rejectionReason: { type: String, required: false, default: "" },
    /** Who processed this request (admin userId) */
    processedBy: { type: String, required: false },
    processedAt: { type: Date, required: false },
    /** Who submitted the request */
    requestedBy: { type: String, required: true },
  },
  { timestamps: true }
);

franchiseKeyRequestSchema.index({ status: 1, createdAt: -1 });
franchiseKeyRequestSchema.index({ franchiseId: 1, status: 1 });

export const FranchiseKeyRequestModel = mongoose.model("FranchiseKeyRequest", franchiseKeyRequestSchema);
