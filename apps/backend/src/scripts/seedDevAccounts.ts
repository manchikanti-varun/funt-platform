import { ROLE } from "@funt-platform/constants";
import { UserModel } from "../models/User.model.js";
import { createAdmin, createStudent, createSuperAdmin } from "../services/auth.service.js";

export const DEV_SUPER_EMAIL = "dev.superadmin@local.test";
export const DEV_ADMIN_EMAIL = "dev.admin@local.test";
export const DEV_STUDENT_USERNAME = "dev.student";

/** Caller must have an active mongoose connection. */
export async function seedDevAccounts(password: string): Promise<string[]> {
  const lines: string[] = [];

  const existingSuper = await UserModel.findOne({ roles: ROLE.SUPER_ADMIN }).select("username").exec();
  if (existingSuper) {
    const un = existingSuper.username?.trim();
    lines.push(
      un
        ? `Super Admin: already exists — username "${un}" (password not changed by this script)`
        : `Super Admin: already exists — username missing in DB; set username or re-seed after fixing data (password not changed)`
    );
  } else {
    const r = await createSuperAdmin({
      name: "Dev Superadmin",
      email: DEV_SUPER_EMAIL,
      mobile: "+910000000001",
      password,
    });
    lines.push(`Super Admin: username "${r.username}"  password: (your DEV_LOGIN_PASSWORD)`);
  }

  const existingAdmin = await UserModel.findOne({ email: DEV_ADMIN_EMAIL }).exec();
  if (existingAdmin) {
    lines.push(`Admin: already exists — username "${existingAdmin.username}"`);
  } else {
    const r = await createAdmin({
      name: "Dev Admin",
      email: DEV_ADMIN_EMAIL,
      mobile: "+910000000002",
      password,
    });
    lines.push(`Admin: username "${r.username}"  password: (your DEV_LOGIN_PASSWORD)`);
  }

  const existingStudent = await UserModel.findOne({
    username: DEV_STUDENT_USERNAME,
    roles: ROLE.STUDENT,
  }).exec();
  if (existingStudent) {
    lines.push(`Student: already exists — username "${DEV_STUDENT_USERNAME}"`);
  } else {
    await createStudent({
      username: DEV_STUDENT_USERNAME,
      name: "Dev Student",
      email: "dev.student@local.test",
      mobile: "+910000000003",
      password,
      age: 12,
      city: "Dev City",
    });
    lines.push(`Student: username "${DEV_STUDENT_USERNAME}"  password: (your DEV_LOGIN_PASSWORD)`);
  }

  return lines;
}
