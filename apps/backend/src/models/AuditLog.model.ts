/**
 * AuditLog Mongoose model – aligned with shared AuditLog type.
 */

import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    targetEntity: { type: String, required: true },
    targetId: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    meta: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

export const AuditLogModel = mongoose.model("AuditLog", auditLogSchema);
