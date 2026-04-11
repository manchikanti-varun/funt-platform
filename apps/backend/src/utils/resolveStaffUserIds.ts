import { ROLE } from "@funt-platform/constants";
import { UserModel } from "../models/User.model.js";
import { AppError } from "./AppError.js";

const MONGO_ID_REGEX = /^[a-fA-F0-9]{24}$/;

const STAFF_ROLES = [ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN];

/** Resolve a MongoDB user id from a 24-char hex id or a username (case-insensitive). User must be trainer, admin, or super admin. */
export async function resolveStaffUserId(raw: string): Promise<string> {
  const v = (raw ?? "").trim();
  if (!v) throw new AppError("User identifier is required", 400);
  const user = MONGO_ID_REGEX.test(v)
    ? await UserModel.findById(v).select("_id roles").lean().exec()
    : await UserModel.findOne({ username: v.toLowerCase() }).select("_id roles").lean().exec();
  if (!user) throw new AppError("User not found", 404);
  const roles = (user as { roles?: string[] }).roles ?? [];
  if (!STAFF_ROLES.some((r) => roles.includes(r))) {
    throw new AppError("User must be a trainer, admin, or super admin", 400);
  }
  return String((user as { _id: unknown })._id);
}

export async function resolveStaffUserIds(rawList: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of rawList) {
    const id = await resolveStaffUserId(raw);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
