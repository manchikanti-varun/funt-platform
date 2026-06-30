import mongoose, { Schema } from "mongoose";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { generateUserFuntId } from "../utils/funtIdGenerator.js";

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
    username: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: false },
    mobile: { type: String, required: true },
    age: { type: Number, required: false },
    address: { type: String, required: false },
    grade: { type: String, required: false },
    gradeOther: { type: String, required: false },
    schoolName: { type: String, required: false },
    city: { type: String, required: false },
    studentXp: { type: Number, required: false, default: 0 },
    studentLevel: { type: Number, required: false, default: 1 },
    coursesCompletedCount: { type: Number, required: false, default: 0 },
    funtCoins: { type: Number, required: false, default: 0 },
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
    linkedStudentUsernames: {
      type: [String],
      required: false,
      default: undefined,
    },
    funtId: { type: String, required: false, unique: true, sparse: true },
    tokenVersion: { type: Number, required: true, default: 0 },
    passwordChangedAt: { type: Date, required: false },
    /** Franchise center this user belongs to (for franchise-scoped trainers) */
    franchiseId: { type: String, required: false, index: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isNew) return;
  if (this.get("funtId")) return;
  this.set("funtId", await generateUserFuntId());
});

userSchema.index({ mobile: 1 });
userSchema.index({ email: 1 });
userSchema.index({ roles: 1, status: 1 });

export const UserModel = mongoose.model("User", userSchema);
