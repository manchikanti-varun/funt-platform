import { ACCOUNT_STATUS, ROLE } from "@funt-platform/constants";
import { UserModel } from "../models/User.model.js";

export type StaffPickerRow = {
  id: string;
  username: string;
  name: string;
  roles: string[];
};

/** Moderators list: admins + super admins only (excluding optional user). Trainer list: trainers + admins + super admins. */
export async function listStaffForPickers(opts: {
  variant: "moderators" | "trainer";
  excludeUserId?: string;
}): Promise<StaffPickerRow[]> {
  const roles =
    opts.variant === "moderators"
      ? [ROLE.ADMIN, ROLE.SUPER_ADMIN]
      : [ROLE.TRAINER, ROLE.ADMIN, ROLE.SUPER_ADMIN];

  const users = await UserModel.find({
    status: ACCOUNT_STATUS.ACTIVE,
    roles: { $in: roles },
  })
    .select("_id username name roles")
    .sort({ username: 1 })
    .lean()
    .exec();

  const excluded = opts.excludeUserId?.trim();
  const filtered =
    excluded ? users.filter((u) => String(u._id) !== excluded && String(u._id).toLowerCase() !== excluded.toLowerCase()) : users;

  return filtered.map((u) => ({
    id: String(u._id),
    username: String(u.username ?? ""),
    name: String(u.name ?? ""),
    roles: Array.isArray(u.roles) ? u.roles : [],
  }));
}
