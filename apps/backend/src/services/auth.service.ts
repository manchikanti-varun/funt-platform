/**
 * Auth service: user creation, login, parent login, lockout.
 */

import bcrypt from "bcrypt";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { UserModel } from "../models/User.model.js";
import {
  generateStudentId,
  generateTrainerId,
  generateAdminId,
  generateSuperAdminId,
  parentIdFromStudentId,
} from "../utils/funtIdGenerator.js";
import { signToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour

export interface CreateStudentInput {
  name: string;
  email?: string;
  mobile: string;
  password: string;
  grade?: string;
  schoolName?: string;
  city?: string;
}

export interface CreateTrainerInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

export interface CreateAdminInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

export interface CreateSuperAdminInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

export interface CreateParentInput {
  name: string;
  mobile: string;
  email?: string;
  linkedStudentFuntIds: string[];
}

export interface LoginInput {
  /** Login by FUNT ID (e.g. FS-26-00001, AD-26-0001, SAD-26-01) + password */
  funtId?: string;
  /** @deprecated Prefer funtId. Kept for backward compatibility. */
  email?: string;
  /** @deprecated Prefer funtId. Kept for backward compatibility. */
  mobile?: string;
  password: string;
}

export interface ParentLoginInput {
  studentFuntId: string;
  mobile: string;
}

export interface LoginResult {
  token: string;
  user: { id: string; funtId: string; name: string; roles: string[]; status: string };
}

function toSafeUser(doc: { _id: unknown; funtId: string; name: string; roles: string[]; status: string }) {
  return {
    id: String(doc._id),
    funtId: doc.funtId,
    name: doc.name,
    roles: doc.roles,
    status: doc.status,
  };
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function createStudent(input: CreateStudentInput): Promise<{ id: string; funtId: string }> {
  const funtId = await generateStudentId();
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.STUDENT],
    status: ACCOUNT_STATUS.ACTIVE,
    ...(input.grade != null && { grade: input.grade }),
    ...(input.schoolName != null && { schoolName: input.schoolName }),
    ...(input.city != null && { city: input.city }),
  });
  return { id: String(user._id), funtId: user.funtId };
}

export async function createTrainer(input: CreateTrainerInput): Promise<{ id: string; funtId: string }> {
  const funtId = await generateTrainerId();
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.TRAINER],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), funtId: user.funtId };
}

export async function createAdmin(input: CreateAdminInput): Promise<{ id: string; funtId: string }> {
  const funtId = await generateAdminId();
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), funtId: user.funtId };
}

/** Super Admin: manual seed only. Call directly when seeding. */
export async function createSuperAdmin(input: CreateSuperAdminInput): Promise<{ id: string; funtId: string }> {
  const funtId = await generateSuperAdminId();
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.SUPER_ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), funtId: user.funtId };
}

/** Create Admin with temporary password = FUNT ID (for approval flow). User must change password after first login. */
export async function createAdminWithTemporaryPassword(input: { name: string; email: string; mobile: string; city?: string }): Promise<{ id: string; funtId: string }> {
  const funtId = await generateAdminId();
  const passwordHash = await hashPassword(funtId);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    ...(input.city != null && input.city !== "" && { city: input.city }),
  });
  return { id: String(user._id), funtId: user.funtId };
}

/** Create Super Admin with temporary password = FUNT ID (for approval flow). */
export async function createSuperAdminWithTemporaryPassword(input: { name: string; email: string; mobile: string; city?: string }): Promise<{ id: string; funtId: string }> {
  const funtId = await generateSuperAdminId();
  const passwordHash = await hashPassword(funtId);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.SUPER_ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    ...(input.city != null && input.city !== "" && { city: input.city }),
  });
  return { id: String(user._id), funtId: user.funtId };
}

export async function createParent(input: CreateParentInput): Promise<{ id: string; funtId: string }> {
  if (!input.linkedStudentFuntIds?.length) {
    throw new AppError("At least one linked student FUNT ID is required to create a parent", 400);
  }
  const funtId = parentIdFromStudentId(input.linkedStudentFuntIds[0]);
  const user = await UserModel.create({
    funtId,
    name: input.name,
    mobile: input.mobile,
    email: input.email,
    roles: [ROLE.PARENT],
    status: ACCOUNT_STATUS.ACTIVE,
    linkedStudentFuntIds: input.linkedStudentFuntIds,
  });
  return { id: String(user._id), funtId: user.funtId };
}

/** Find user by FUNT ID for login */
async function findUserByFuntId(funtId: string) {
  return UserModel.findOne({ funtId: funtId.trim() }).select("+passwordHash +loginAttempts +lockedUntil +loginHistory");
}

/** Find user by email or mobile (legacy) */
async function findUserByEmailOrMobile(email?: string, mobile?: string) {
  if (email) {
    return UserModel.findOne({ email }).select("+passwordHash +loginAttempts +lockedUntil +loginHistory");
  }
  if (mobile) {
    return UserModel.findOne({ mobile }).select("+passwordHash +loginAttempts +lockedUntil +loginHistory");
  }
  return null;
}

export async function login(
  input: LoginInput,
  jwtSecret: string,
  expiresIn: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<LoginResult> {
  let user = null;
  if (input.funtId?.trim()) {
    user = await findUserByFuntId(input.funtId);
  }
  if (!user && (input.email || input.mobile)) {
    user = await findUserByEmailOrMobile(input.email, input.mobile);
  }
  if (!user) {
    throw new AppError("Invalid FUNT ID or password", 401);
  }

  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError("Account is suspended or archived", 403);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(`Account locked. Try again after ${user.lockedUntil.toISOString()}`, 423);
  }

  if (!user.passwordHash) {
    throw new AppError("Invalid FUNT ID or password", 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    await UserModel.updateOne(
      { _id: user._id },
      {
        $inc: { loginAttempts: 1 },
        ...(user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS
          ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) }
          : {}),
      }
    ).exec();
    throw new AppError("Invalid FUNT ID or password", 401);
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: { loginAttempts: 0, lockedUntil: null },
      $push: {
        loginHistory: {
          $each: [{ timestamp: new Date(), userAgent: meta?.userAgent, ip: meta?.ip }],
          $slice: -20,
        },
      },
    }
  ).exec();

  const token = signToken(
    { userId: String(user._id), funtId: user.funtId, roles: user.roles as ROLE[] },
    jwtSecret,
    expiresIn
  );
  return { token, user: toSafeUser(user) };
}

export async function parentLogin(
  input: ParentLoginInput,
  jwtSecret: string,
  expiresIn: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<LoginResult> {
  const user = await UserModel.findOne({
    mobile: input.mobile,
    roles: ROLE.PARENT,
  })
    .select("+loginAttempts +lockedUntil +loginHistory")
    .exec();

  if (!user) {
    throw new AppError("Invalid mobile or student link", 401);
  }

  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError("Account is suspended or archived", 403);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(`Account locked. Try again after ${user.lockedUntil.toISOString()}`, 423);
  }

  const linked = user.linkedStudentFuntIds && user.linkedStudentFuntIds.includes(input.studentFuntId);
  if (!linked) {
    await UserModel.updateOne(
      { _id: user._id },
      {
        $inc: { loginAttempts: 1 },
        ...(user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS
          ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) }
          : {}),
      }
    ).exec();
    throw new AppError("Invalid mobile or student link", 401);
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: { loginAttempts: 0, lockedUntil: null },
      $push: {
        loginHistory: {
          $each: [{ timestamp: new Date(), userAgent: meta?.userAgent, ip: meta?.ip }],
          $slice: -20,
        },
      },
    }
  ).exec();

  const token = signToken(
    { userId: String(user._id), funtId: user.funtId, roles: user.roles as ROLE[] },
    jwtSecret,
    expiresIn
  );
  return { token, user: toSafeUser(user) };
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

/** Resolve FUNT ID or MongoDB _id to user's MongoDB _id. Throws if not found. */
export async function resolveUserIdFromIdentifier(identifier: string): Promise<string> {
  const v = (identifier ?? "").trim();
  if (!v) throw new AppError("User identifier (FUNT ID or user ID) is required", 400);
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).select("_id").lean().exec();
    if (!user) throw new AppError("User not found", 404);
    return String(user._id);
  }
  const user = await UserModel.findOne({ funtId: v }).select("_id").lean().exec();
  if (!user) throw new AppError("User not found (invalid FUNT ID or user ID)", 404);
  return String(user._id);
}

/** Change password for the logged-in user. Verifies current password then sets new. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  if (!currentPassword?.trim()) throw new AppError("Current password is required", 400);
  if (!newPassword?.trim()) throw new AppError("New password is required", 400);
  const user = await UserModel.findById(userId).select("+passwordHash").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const hash = (user as unknown as { passwordHash: string }).passwordHash;
  if (!hash) throw new AppError("Current password is incorrect", 401);
  const match = await bcrypt.compare(currentPassword.trim(), hash);
  if (!match) throw new AppError("Current password is incorrect", 401);
  const passwordHash = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);
  await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } }).exec();
}

/** Admin: reset login (clear lockout) and set password to FUNT ID. Accepts FUNT ID or MongoDB _id. */
export async function resetLoginAttempts(userIdentifier: string): Promise<void> {
  const v = (userIdentifier ?? "").trim();
  if (!v) throw new AppError("User identifier (FUNT ID or user ID) is required", 400);
  const query = OBJECT_ID_REGEX.test(v)
    ? { _id: v }
    : { funtId: v };
  const user = await UserModel.findOne(query).select("_id funtId").lean().exec();
  if (!user) throw new AppError("User not found (invalid FUNT ID or user ID)", 404);
  const userId = String(user._id);
  const funtId = (user as { funtId: string }).funtId;
  const passwordHash = await bcrypt.hash(funtId, SALT_ROUNDS);
  await UserModel.updateOne(
    { _id: userId },
    { $set: { passwordHash, loginAttempts: 0, lockedUntil: null } }
  ).exec();
}
