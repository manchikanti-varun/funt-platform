import mongoose, { Schema } from "mongoose";
import {
  FRANCHISE_TRANSACTION_TYPE,
  FRANCHISE_PAYOUT_STATUS,
} from "@funt-platform/constants";

/**
 * FranchiseTransaction — centralized ledger for all franchise money movements.
 *
 * Every payment collected (online/offline), commission earned, payout made, and
 * manual adjustment is recorded here. Monthly aggregation uses the `month` field.
 */
const franchiseTransactionSchema = new Schema(
  {
    franchiseId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(FRANCHISE_TRANSACTION_TYPE),
    },
    /** Amount in paise (always positive). Direction determines credit/debit. */
    amountPaise: { type: Number, required: true, min: 0 },
    /** CREDIT = money attributed to franchise, DEBIT = paid out or deducted */
    direction: { type: String, required: true, enum: ["CREDIT", "DEBIT"] },

    // ── References (optional) ────────────────────────────────────────────
    studentId: { type: String, required: false },
    enrollmentId: { type: String, required: false },
    invoiceId: { type: String, required: false },
    batchId: { type: String, required: false },

    /** Free-text note (e.g. "Cash collected from Amit Kumar") */
    note: { type: String, required: false, default: "" },
    /** Who recorded this entry (userId) */
    recordedBy: { type: String, required: true },
    /** Month key for easy aggregation: "2026-07" */
    month: { type: String, required: true },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
franchiseTransactionSchema.index({ franchiseId: 1, month: 1 });
franchiseTransactionSchema.index({ franchiseId: 1, type: 1 });
franchiseTransactionSchema.index({ studentId: 1 });

export const FranchiseTransactionModel = mongoose.model("FranchiseTransaction", franchiseTransactionSchema);

/**
 * FranchisePayout — tracks monthly/periodic payouts to franchise owners.
 */
const franchisePayoutSchema = new Schema(
  {
    franchiseId: { type: String, required: true, index: true },
    /** Period this payout covers: "2026-07" */
    month: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: Object.values(FRANCHISE_PAYOUT_STATUS),
      default: FRANCHISE_PAYOUT_STATUS.PENDING,
    },
    paidAt: { type: Date, required: false },
    /** Payment reference (UPI txn ID, bank ref, etc.) */
    paymentReference: { type: String, required: false, default: "" },
    note: { type: String, required: false, default: "" },
    processedBy: { type: String, required: false },
  },
  { timestamps: true }
);

franchisePayoutSchema.index({ franchiseId: 1, month: 1 });
franchisePayoutSchema.index({ status: 1 });

export const FranchisePayoutModel = mongoose.model("FranchisePayout", franchisePayoutSchema);
