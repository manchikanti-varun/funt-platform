/**
 * Registration request – Admin or Super Admin account request; Super Admin approves to create account.
 */

import mongoose, { Schema } from "mongoose";

const registrationRequestSchema = new Schema(
  {
    roleType: { type: String, required: true, enum: ["ADMIN", "SUPER_ADMIN"] },
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    city: { type: String, required: false },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    requestedAt: { type: Date, required: true, default: Date.now },
    requestedBy: { type: String, required: false },
    approvedBy: { type: String, required: false },
    approvedAt: { type: Date, required: false },
    createdUserId: { type: String, required: false },
    rejectionReason: { type: String, required: false },
  },
  { timestamps: true }
);

registrationRequestSchema.index({ email: 1, roleType: 1, status: 1 });
registrationRequestSchema.index({ status: 1, requestedAt: -1 });

export const RegistrationRequestModel = mongoose.model(
  "RegistrationRequest",
  registrationRequestSchema
);
