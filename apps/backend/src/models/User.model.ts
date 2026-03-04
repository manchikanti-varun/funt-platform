
import mongoose, { Schema } from "mongoose";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";

const loginHistoryEntrySchema = new Schema(
  {
    timestamp: { type: Date, required: true, default: Date.now },
    userAgent: { type: String, required: false },
    ip: { type: String, required: false },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    funtId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: false },
    mobile: { type: String, required: true },
    grade: { type: String, required: false },
    schoolName: { type: String, required: false },
    city: { type: String, required: false },
    passwordHash: { type: String, required: false, select: false },
    roles: {
      type: [String],
      required: true,
      enum: Object.values(ROLE),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.ACTIVE,
    },
    loginAttempts: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, required: false },
    loginHistory: {
      type: [loginHistoryEntrySchema],
      default: [],
      select: false,
    },
    linkedStudentFuntIds: {
      type: [String],
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1 });
userSchema.index({ email: 1 });

export const UserModel = mongoose.model("User", userSchema);
