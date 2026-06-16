
import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    /** Pre-computed display name of the actor (username). Avoids lookup on read. */
    performedByDisplay: { type: String, required: false },
    targetEntity: { type: String, required: true },
    targetId: { type: String, required: true },
    /** Pre-computed display label for the target (e.g. batch name, certificate ID). Avoids lookup on read. */
    targetIdDisplay: { type: String, required: false },
    timestamp: { type: Date, required: true, default: Date.now },
    meta: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

export const AuditLogModel = mongoose.model("AuditLog", auditLogSchema);
