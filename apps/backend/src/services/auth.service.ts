
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { ROLE, ACCOUNT_STATUS } from "@funt-platform/constants";
import { UserModel } from "../models/User.model.js";
import { signToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { createAuditLog } from "./audit.service.js";
import { cacheDel, CACHE_KEYS } from "../utils/cache.js";
import {
  buildAdminUsernameBase,
  normalizeStudentUsername,
  validateAdminUsername,
  validateStudentUsername,
} from "../utils/username.js";

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
};

export interface CreateStudentInput {
  username: string;
  name: string;
  email?: string;
  mobile: string;
  /**
   * Optional. Omit to create a passwordless account (e.g. Google-only sign-up).
   * The user can later set a password via the secure set-password flow.
   */
  password?: string;
  age: number;
  address?: string;
  grade?: string;
  gradeOther?: string;
  schoolName?: string;
  city?: string;
}

export interface CreateTrainerInput {
  username: string;
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
  linkedStudentUsernames: string[];
}

export interface LoginInput {
  username?: string;
  email?: string;
  mobile?: string;
  password: string;
}

export interface ParentLoginInput {
  studentUsername: string;
  mobile: string;
}

export interface ParentLinkedStudent {
  username: string;
  name: string;
  grade?: string;
  schoolName?: string;
  city?: string;
}

export interface LoginResult {
  token: string;
  user: { id: string; username: string; name: string; roles: string[]; status: string };
}

function toSafeUser(doc: {
  _id: unknown;
  username?: string | null;
  name: string;
  roles: string[];
  status: string;
}) {
  return {
    id: String(doc._id),
    username: doc.username?.trim() ?? "",
    name: doc.name,
    roles: doc.roles,
    status: doc.status,
  };
}

async function uniqueAdminUsernameFromName(name: string): Promise<string> {
  const base = buildAdminUsernameBase(name);
  let candidate = base;
  for (let i = 0; i < 80; i++) {
    // Use atomic check: attempt to create a short-lived reservation is impractical
    // with Mongoose, so we check and rely on the unique index to reject collisions.
    // If two concurrent requests pick the same candidate, the second will fail at
    // UserModel.create() with a 11000 error — callers must handle that gracefully.
    const exists = await UserModel.findOne({ username: candidate }).select("_id").lean().exec();
    if (!exists) return candidate;
    const local = base.replace(/@funt$/, "");
    candidate = `${local}${crypto.randomInt(10, 9999)}@funt`;
  }
  throw new AppError("Could not allocate admin username", 500);
}

async function uniqueParentUsername(name: string): Promise<string> {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 12)
    .toLowerCase() || "user";
  let candidate = `parent.${slug}`;
  for (let i = 0; i < 80; i++) {
    const exists = await UserModel.findOne({ username: candidate }).select("_id").lean().exec();
    if (!exists) return candidate;
    candidate = `parent.${slug}${crypto.randomInt(10, 9999)}`;
  }
  throw new AppError("Could not allocate parent username", 500);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function validateStrongPassword(password: string): void {
  const raw = String(password ?? "");
  if (raw.length < PASSWORD_MIN_LENGTH) {
    throw new AppError("Password must be at least 8 characters", 400);
  }
  if (!PASSWORD_REGEX.upper.test(raw)) {
    throw new AppError("Password must contain at least one uppercase letter", 400);
  }
  if (!PASSWORD_REGEX.lower.test(raw)) {
    throw new AppError("Password must contain at least one lowercase letter", 400);
  }
  if (!PASSWORD_REGEX.number.test(raw)) {
    throw new AppError("Password must contain at least one number", 400);
  }
  if (!PASSWORD_REGEX.special.test(raw)) {
    throw new AppError("Password must contain at least one special character", 400);
  }
}

function randomTemporaryPassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

export async function createStudent(input: CreateStudentInput): Promise<{ id: string; username: string }> {
  const uErr = validateStudentUsername(input.username);
  if (uErr) throw new AppError(uErr, 400);
  const uname = normalizeStudentUsername(input.username);
  if (input.age < 7) throw new AppError("Minimum age is 7 years", 400);
  let passwordHash: string | undefined;
  if (input.password != null && input.password !== "") {
    validateStrongPassword(input.password);
    passwordHash = await hashPassword(input.password);
  }
  const gradeVal = input.grade?.trim();
  const gradeOther = input.gradeOther?.trim();
  const user = await UserModel.create({
    username: uname,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    ...(passwordHash != null && { passwordHash }),
    roles: [ROLE.STUDENT],
    status: ACCOUNT_STATUS.ACTIVE,
    age: input.age,
    ...(input.address != null && input.address !== "" && { address: input.address.trim() }),
    ...(gradeVal != null && gradeVal !== "" && { grade: gradeVal }),
    ...(gradeOther != null && gradeOther !== "" && { gradeOther }),
    ...(input.schoolName != null && { schoolName: input.schoolName }),
    ...(input.city != null && { city: input.city }),
  });
  return { id: String(user._id), username: user.username! };
}

export async function createTrainer(input: CreateTrainerInput): Promise<{ id: string; username: string }> {
  const normalizedUsername = input.username.trim().toLowerCase();
  const uErr = validateAdminUsername(normalizedUsername);
  if (uErr) throw new AppError(uErr, 400);
  validateStrongPassword(input.password);
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    username: normalizedUsername,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.TRAINER],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), username: user.username! };
}

export async function createSupportAgent(input: CreateTrainerInput): Promise<{ id: string; username: string }> {
  const normalizedUsername = input.username.trim().toLowerCase();
  const uErr = validateAdminUsername(normalizedUsername);
  if (uErr) throw new AppError(uErr, 400);
  validateStrongPassword(input.password);
  const passwordHash = await hashPassword(input.password);
  const user = await UserModel.create({
    username: normalizedUsername,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.SUPPORT_AGENT],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), username: user.username! };
}

export async function createSupportAgentWithHash(input: {
  name: string; email: string; mobile: string; passwordHash: string;
}): Promise<{ id: string; username: string }> {
  const username = await uniqueAdminUsernameFromName(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash: input.passwordHash,
    roles: [ROLE.SUPPORT_AGENT],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), username: user.username! };
}

export async function createSupportAgentWithTempPassword(input: {
  name: string; email: string; mobile: string;
}): Promise<{ id: string; username: string; temporaryPassword: string }> {
  const username = await uniqueAdminUsernameFromName(input.name);
  const temporaryPassword = randomTemporaryPassword();
  const hash = await hashPassword(temporaryPassword);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash: hash,
    roles: [ROLE.SUPPORT_AGENT],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), username: user.username!, temporaryPassword };
}

export async function createAdmin(input: CreateAdminInput): Promise<{ id: string; username: string }> {
  validateStrongPassword(input.password);
  const passwordHash = await hashPassword(input.password);
  const username = await uniqueAdminUsernameFromName(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), username: user.username! };
}

export async function createSuperAdmin(input: CreateSuperAdminInput): Promise<{ id: string; username: string }> {
  validateStrongPassword(input.password);
  const passwordHash = await hashPassword(input.password);
  const username = await uniqueAdminUsernameFromName(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.SUPER_ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
  });
  return { id: String(user._id), username: user.username! };
}

/** Create Admin using a bcrypt hash (e.g. password chosen at signup, stored on registration request). */
export async function createAdminWithHashedPassword(input: {
  name: string;
  email: string;
  mobile: string;
  city?: string;
  passwordHash: string;
}): Promise<{ id: string; username: string }> {
  const username = await uniqueAdminUsernameFromName(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash: input.passwordHash,
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    ...(input.city != null && input.city !== "" && { city: input.city }),
  });
  return { id: String(user._id), username: user.username! };
}

export async function createAdminWithTemporaryPassword(input: {
  name: string;
  email: string;
  mobile: string;
  city?: string;
}): Promise<{ id: string; username: string; temporaryPassword: string }> {
  const temporaryPassword = randomTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const username = await uniqueAdminUsernameFromName(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    ...(input.city != null && input.city !== "" && { city: input.city }),
  });
  return { id: String(user._id), username: user.username!, temporaryPassword };
}

export async function createSuperAdminWithTemporaryPassword(input: {
  name: string;
  email: string;
  mobile: string;
  city?: string;
}): Promise<{ id: string; username: string; temporaryPassword: string }> {
  const temporaryPassword = randomTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const username = await uniqueAdminUsernameFromName(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    passwordHash,
    roles: [ROLE.SUPER_ADMIN],
    status: ACCOUNT_STATUS.ACTIVE,
    ...(input.city != null && input.city !== "" && { city: input.city }),
  });
  return { id: String(user._id), username: user.username!, temporaryPassword };
}

export async function createParent(input: CreateParentInput): Promise<{ id: string; username: string }> {
  if (!input.linkedStudentUsernames?.length) {
    throw new AppError("At least one linked student username is required to create a parent", 400);
  }
  const linked = input.linkedStudentUsernames.map((s) => normalizeStudentUsername(String(s)));
  for (const uname of linked) {
    const st = await UserModel.findOne({ username: uname, roles: ROLE.STUDENT }).exec();
    if (!st) throw new AppError(`Student not found for username: ${uname}`, 400);
  }
  const username = await uniqueParentUsername(input.name);
  const user = await UserModel.create({
    username,
    name: input.name,
    mobile: input.mobile,
    email: input.email,
    roles: [ROLE.PARENT],
    status: ACCOUNT_STATUS.ACTIVE,
    linkedStudentUsernames: linked,
  });
  return { id: String(user._id), username: user.username! };
}

async function findUserByEmailOrMobile(email?: string, mobile?: string) {
  if (email) {
    return UserModel.findOne({ email }).select("+passwordHash +loginAttempts +lockedUntil +loginHistory");
  }
  if (mobile) {
    return UserModel.findOne({ mobile }).select("+passwordHash +loginAttempts +lockedUntil +loginHistory");
  }
  return null;
}

async function findUserForPasswordLogin(input: LoginInput) {
  const raw = (input.username ?? "").trim();
  if (raw) {
    const user = await UserModel.findOne({ username: raw.toLowerCase() })
      .select("+passwordHash +loginAttempts +lockedUntil +loginHistory")
      .exec();
    if (user) return user;
    // If the "username" looks like an email and no exact username match, try email lookup
    if (raw.includes("@") && !input.email) {
      const byEmail = await findUserByEmailOrMobile(raw.toLowerCase(), undefined);
      if (byEmail) return byEmail;
    }
  }
  if (input.email || input.mobile) {
    return findUserByEmailOrMobile(input.email, input.mobile);
  }
  return null;
}

export async function login(
  input: LoginInput,
  jwtSecret: string,
  expiresIn: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<LoginResult> {
  const user = await findUserForPasswordLogin(input);
  if (!user) {
    throw new AppError("Invalid username or password", 401);
  }

  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    // Use generic message to avoid revealing that the account exists
    throw new AppError("Invalid username or password", 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("Too many failed attempts. Please try again later.", 423);
  }

  if (!user.passwordHash) {
    throw new AppError("Invalid username or password", 401);
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
    // Audit: failed login attempt (fire-and-forget, non-blocking)
    createAuditLog("USER_LOGIN_FAILED", String(user._id), "User", String(user._id), {
      username: user.username,
      ip: meta?.ip,
    }).catch(() => {});
    throw new AppError("Invalid username or password", 401);
  }

  const updated = await UserModel.findOneAndUpdate(
    { _id: user._id },
    {
      $inc: { tokenVersion: 1 },
      $set: { loginAttempts: 0, lockedUntil: null },
      $push: {
        loginHistory: {
          $each: [{ timestamp: new Date(), userAgent: meta?.userAgent, ip: meta?.ip }],
          $slice: -20,
        },
      },
    },
    { new: true }
  )
    .select("tokenVersion")
    .lean()
    .exec();
  if (!updated) {
    throw new AppError("User not found", 401);
  }

  // Invalidate cached user so auth middleware reads the fresh tokenVersion
  await cacheDel(CACHE_KEYS.user(String(user._id))).catch(() => {});

  const token = signToken(
    {
      userId: String(user._id),
      username: user.username ?? "",
      roles: user.roles as ROLE[],
      tokenVersion: Number((updated as { tokenVersion?: number }).tokenVersion ?? 0),
    },
    jwtSecret,
    expiresIn
  );
  // Audit: successful login (fire-and-forget, non-blocking)
  createAuditLog("USER_LOGIN_SUCCESS", String(user._id), "User", String(user._id), {
    username: user.username,
    ip: meta?.ip,
  }).catch(() => {});
  return { token, user: toSafeUser(user) };
}

export async function parentLogin(
  input: ParentLoginInput,
  jwtSecret: string,
  expiresIn: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<LoginResult> {
  const studentU = normalizeStudentUsername(input.studentUsername);
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
    throw new AppError("Invalid mobile or student link", 401);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("Too many failed attempts. Please try again later.", 423);
  }

  const linked = user.linkedStudentUsernames && user.linkedStudentUsernames.includes(studentU);
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

  const updated = await UserModel.findOneAndUpdate(
    { _id: user._id },
    {
      $inc: { tokenVersion: 1 },
      $set: { loginAttempts: 0, lockedUntil: null },
      $push: {
        loginHistory: {
          $each: [{ timestamp: new Date(), userAgent: meta?.userAgent, ip: meta?.ip }],
          $slice: -20,
        },
      },
    },
    { new: true }
  )
    .select("tokenVersion")
    .lean()
    .exec();
  if (!updated) {
    throw new AppError("User not found", 401);
  }

  // Invalidate cached user so auth middleware reads the fresh tokenVersion
  await cacheDel(CACHE_KEYS.user(String(user._id))).catch(() => {});

  const token = signToken(
    {
      userId: String(user._id),
      username: user.username ?? "",
      roles: user.roles as ROLE[],
      tokenVersion: Number((updated as { tokenVersion?: number }).tokenVersion ?? 0),
    },
    jwtSecret,
    expiresIn
  );
  return { token, user: toSafeUser(user) };
}

export async function getParentLinkedStudentsByMobile(
  mobile: string
): Promise<{ parentName: string; students: ParentLinkedStudent[] }> {
  const normalizedMobile = (mobile ?? "").trim();
  if (!normalizedMobile) throw new AppError("Parent mobile is required", 400);

  // Preferred in this flow: parent mobile is stored on student profiles.
  const mobileStudents = await UserModel.find({
    mobile: normalizedMobile,
    roles: ROLE.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select("username name grade schoolName city")
    .sort({ name: 1 })
    .lean()
    .exec();
  if (mobileStudents.length > 0) {
    return {
      parentName: "Parent",
      students: mobileStudents.map((s) => ({
        username: s.username,
        name: s.name,
        grade: s.grade ?? "",
        schoolName: s.schoolName ?? "",
        city: s.city ?? "",
      })),
    };
  }

  // Backward compatible fallback: dedicated parent account with linked students.
  const parent = await UserModel.findOne({
    mobile: normalizedMobile,
    roles: ROLE.PARENT,
  })
    .select("name status linkedStudentUsernames")
    .lean()
    .exec();

  if (!parent) throw new AppError("Parent account not found for this mobile number", 404);
  if (parent.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError("Parent account is suspended or archived", 403);
  }

  const linkedUsernames = (parent.linkedStudentUsernames ?? [])
    .map((u) => normalizeStudentUsername(String(u)))
    .filter(Boolean);
  if (linkedUsernames.length === 0) {
    return { parentName: parent.name, students: [] };
  }

  const students = await UserModel.find({
    username: { $in: linkedUsernames },
    roles: ROLE.STUDENT,
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select("username name grade schoolName city")
    .lean()
    .exec();

  const byUsername = new Map<string, ParentLinkedStudent>(
    students.map((s) => [
      s.username,
      {
        username: s.username,
        name: s.name,
        grade: s.grade ?? "",
        schoolName: s.schoolName ?? "",
        city: s.city ?? "",
      },
    ])
  );
  const ordered = linkedUsernames
    .map((u) => byUsername.get(u))
    .filter((v): v is ParentLinkedStudent => v != null);

  return { parentName: parent.name, students: ordered };
}

export async function assertParentStudentLinked(mobile: string, studentUsername: string): Promise<void> {
  const normalizedMobile = (mobile ?? "").trim();
  const normalizedStudent = normalizeStudentUsername(studentUsername);
  if (!normalizedMobile) throw new AppError("Parent mobile is required", 400);
  if (!normalizedStudent) throw new AppError("Student username is required", 400);

  // Preferred validation: selected student has the same mobile in student profile.
  const studentByMobile = await UserModel.findOne({
    username: normalizedStudent,
    roles: ROLE.STUDENT,
    mobile: normalizedMobile,
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select("_id")
    .lean()
    .exec();
  if (studentByMobile) return;

  // Backward compatible fallback: parent account linkage.
  const parent = await UserModel.findOne({
    mobile: normalizedMobile,
    roles: ROLE.PARENT,
  })
    .select("status linkedStudentUsernames")
    .lean()
    .exec();

  if (!parent) throw new AppError("Parent account not found for this mobile number", 404);
  if (parent.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError("Parent account is suspended or archived", 403);
  }

  const linked = (parent.linkedStudentUsernames ?? []).map((u) => normalizeStudentUsername(String(u)));
  if (!linked.includes(normalizedStudent)) {
    throw new AppError("Selected student is not linked to this parent", 403);
  }
}

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export async function resolveUserIdFromIdentifier(identifier: string): Promise<string> {
  const v = (identifier ?? "").trim();
  if (!v) throw new AppError("User identifier (username or user ID) is required", 400);
  if (OBJECT_ID_REGEX.test(v)) {
    const user = await UserModel.findById(v).select("_id").lean().exec();
    if (!user) throw new AppError("User not found", 404);
    return String(user._id);
  }
  const user = await UserModel.findOne({ username: v.toLowerCase() }).select("_id").lean().exec();
  if (!user) throw new AppError("User not found (invalid username or user ID)", 404);
  return String(user._id);
}

export async function lookupStudentUsernameByEmail(email: string): Promise<{ username: string | null }> {
  const normalized = email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalized }).select("username roles").lean().exec();
  if (!user) throw new AppError("No account found for this email", 404);
  if (!(user.roles as string[])?.includes(ROLE.STUDENT)) {
    throw new AppError("No student account found for this email", 404);
  }
  return { username: (user as { username?: string }).username ?? null };
}

export async function setUsernameBySuperAdmin(targetUserId: string, rawUsername: string): Promise<void> {
  const user = await UserModel.findById(targetUserId).exec();
  if (!user) throw new AppError("User not found", 404);
  const v = rawUsername.trim().toLowerCase();
  const isStaff =
    user.roles?.includes(ROLE.ADMIN) || user.roles?.includes(ROLE.SUPER_ADMIN) || user.roles?.includes(ROLE.TRAINER);
  if (isStaff) {
    const e = validateAdminUsername(v);
    if (e) throw new AppError(e, 400);
  } else {
    const e = validateStudentUsername(v);
    if (e) throw new AppError(e, 400);
  }
  const taken = await UserModel.findOne({ username: v, _id: { $ne: user._id } }).lean().exec();
  if (taken) throw new AppError("Username already taken", 400);
  await UserModel.updateOne({ _id: user._id }, { $set: { username: v } }).exec();
}

/**
 * Decide whether a caller with `callerRoles` may perform a password / identity
 * action on a user with `targetRoles`.
 *
 * Rules:
 *  - SUPER_ADMIN can act on anyone.
 *  - ADMIN can act on STUDENT or TRAINER only — never on another ADMIN or
 *    SUPER_ADMIN. (This prevents an admin from resetting a super admin's
 *    password or hijacking an admin account.)
 *  - All other callers are rejected.
 */
function assertCallerCanManageTarget(
  callerRoles: readonly string[] | undefined,
  targetRoles: readonly string[] | undefined,
  action: "reset login" | "update identity"
): void {
  const caller = new Set(callerRoles ?? []);
  const target = new Set(targetRoles ?? []);
  if (caller.has(ROLE.SUPER_ADMIN)) return;
  if (caller.has(ROLE.ADMIN)) {
    if (target.has(ROLE.SUPER_ADMIN) || target.has(ROLE.ADMIN)) {
      throw new AppError(
        `Only a Super Admin can ${action} for another Admin or Super Admin.`,
        403
      );
    }
    return;
  }
  throw new AppError(`You do not have permission to ${action}.`, 403);
}

export async function updateUserIdentityByAdmin(
  targetUserId: string,
  input: { username?: string; email?: string; mobile?: string },
  callerRoles?: readonly string[]
): Promise<void> {
  const user = await UserModel.findById(targetUserId).exec();
  if (!user) throw new AppError("User not found", 404);
  assertCallerCanManageTarget(callerRoles, user.roles, "update identity");

  const updates: Record<string, string> = {};
  if (input.username != null) {
    const username = input.username.trim().toLowerCase();
    const isStaff =
      user.roles?.includes(ROLE.ADMIN) || user.roles?.includes(ROLE.SUPER_ADMIN) || user.roles?.includes(ROLE.TRAINER);
    if (isStaff) {
      const e = validateAdminUsername(username);
      if (e) throw new AppError(e, 400);
    } else {
      const e = validateStudentUsername(username);
      if (e) throw new AppError(e, 400);
    }
    const taken = await UserModel.findOne({ username, _id: { $ne: user._id } }).lean().exec();
    if (taken) throw new AppError("Username already taken", 400);
    updates.username = username;
  }

  if (input.email != null) {
    const email = input.email.trim().toLowerCase();
    updates.email = email;
  }
  if (input.mobile != null) {
    const mobile = input.mobile.trim();
    updates.mobile = mobile;
  }
  if (Object.keys(updates).length === 0) throw new AppError("No identity fields provided", 400);
  await UserModel.updateOne({ _id: user._id }, { $set: updates }).exec();
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  if (!currentPassword?.trim()) throw new AppError("Current password is required", 400);
  if (!newPassword?.trim()) throw new AppError("New password is required", 400);
  validateStrongPassword(newPassword.trim());
  const user = await UserModel.findById(userId).select("+passwordHash").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const hash = (user as unknown as { passwordHash: string }).passwordHash;
  if (!hash) throw new AppError("Current password is incorrect", 401);
  const match = await bcrypt.compare(currentPassword.trim(), hash);
  if (!match) throw new AppError("Current password is incorrect", 401);
  const passwordHash = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: { passwordHash, passwordChangedAt: new Date() },
      $inc: { tokenVersion: 1 },
    }
  ).exec();
  // Invalidate cached user so auth middleware reads the fresh tokenVersion
  await cacheDel(CACHE_KEYS.user(userId)).catch(() => {});
}

/**
 * Set an initial password for a user that currently has no `passwordHash`.
 * Used by the secure "set password" flow that is gated by a fresh Google re-auth.
 * Refuses to overwrite an existing password — use `changePassword` for that.
 */
export async function setInitialPassword(userId: string, newPassword: string): Promise<void> {
  if (!newPassword?.trim()) throw new AppError("New password is required", 400);
  validateStrongPassword(newPassword.trim());
  const user = await UserModel.findById(userId).select("+passwordHash").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const existingHash = (user as unknown as { passwordHash?: string }).passwordHash;
  if (existingHash) {
    throw new AppError(
      "This account already has a password. Use the change-password flow instead.",
      400
    );
  }
  const passwordHash = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: { passwordHash, passwordChangedAt: new Date() },
      $inc: { tokenVersion: 1 },
    }
  ).exec();
  // Invalidate cached user so auth middleware reads the fresh tokenVersion
  await cacheDel(CACHE_KEYS.user(userId)).catch(() => {});
}

export async function resetLoginAttemptsByUsername(
  username: string,
  newPassword: string,
  callerRoles?: readonly string[]
): Promise<void> {
  const uname = (username ?? "").trim().toLowerCase();
  if (!uname) throw new AppError("Username is required", 400);
  validateStrongPassword(String(newPassword ?? "").trim());
  const user = await UserModel.findOne({ username: uname }).select("_id roles").lean().exec();
  if (!user) throw new AppError("User not found (invalid username)", 404);
  assertCallerCanManageTarget(callerRoles, user.roles, "reset login");
  const userId = String(user._id);
  const passwordHash = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: { passwordHash, loginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
      $inc: { tokenVersion: 1 },
    }
  ).exec();
  // Invalidate cached user so auth middleware reads the fresh tokenVersion
  await cacheDel(CACHE_KEYS.user(userId)).catch(() => {});
}
