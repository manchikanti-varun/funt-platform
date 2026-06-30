import mongoose, { Schema } from "mongoose";
import {
  FRANCHISE_STATUS,
  FRANCHISE_COMMISSION_MODEL,
} from "@funt-platform/constants";

const franchiseCenterSchema = new Schema(
  {
    /** Human-readable franchise code, e.g. "JAIPUR-01" */
    franchiseCode: { type: String, required: true, unique: true },
    /** Display name for the center */
    centerName: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: false, default: "" },

    // ── Owner (FRANCHISE_ADMIN user) ─────────────────────────────────────
    ownerUserId: { type: String, required: true, unique: true },
    ownerName: { type: String, required: true },
    ownerMobile: { type: String, required: true },
    ownerEmail: { type: String, required: false, default: "" },

    // ── Commission configuration ─────────────────────────────────────────
    commissionModel: {
      type: String,
      required: true,
      enum: Object.values(FRANCHISE_COMMISSION_MODEL),
      default: FRANCHISE_COMMISSION_MODEL.PERCENTAGE,
    },
    /** Commission percentage (0–100). Used when commissionModel = PERCENTAGE. */
    commissionPercent: { type: Number, required: false, default: 30, min: 0, max: 100 },
    /** Flat commission per enrollment in paise. Used when commissionModel = FLAT_PER_STUDENT. */
    commissionFlatPaise: { type: Number, required: false, default: 0, min: 0 },

    // ── Batch assignment ─────────────────────────────────────────────────
    /** Batch Mongo IDs that this franchise operates (created by franchise or assigned by parent) */
    assignedBatchIds: { type: [String], required: true, default: [] },

    // ── Status ───────────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: Object.values(FRANCHISE_STATUS),
      default: FRANCHISE_STATUS.ACTIVE,
    },
    onboardedAt: { type: Date, required: true, default: Date.now },

    // ── Cached stats (updated periodically or on events) ─────────────────
    totalStudents: { type: Number, required: false, default: 0, min: 0 },
    totalRevenuePaise: { type: Number, required: false, default: 0, min: 0 },
    pendingPayoutPaise: { type: Number, required: false, default: 0, min: 0 },

    /** Created by (Super Admin who onboarded this franchise) */
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
franchiseCenterSchema.index({ status: 1 });
franchiseCenterSchema.index({ city: 1 });

export const FranchiseCenterModel = mongoose.model("FranchiseCenter", franchiseCenterSchema);
