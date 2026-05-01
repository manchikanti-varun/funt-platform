import { ROLE } from "@funt-platform/constants";
import { UserModel } from "../models/User.model.js";
import { createAdmin, createStudent, createSuperAdmin } from "../services/auth.service.js";

/** Fixed identities for local development — password always comes from DEV_LOGIN_PASSWORD in .env. */
export const DEV_LOCAL_SUPER_EMAIL = "dev.superadmin@local.test";
export const DEV_LOCAL_ADMIN_EMAIL = "dev.admin@local.test";
export const DEV_LOCAL_STUDENT_USERNAME = "dev.student";
export const DEV_LOCAL_STUDENT_EMAIL = "dev.student@local.test";

export function printDevLoginReport(lines: string[]): void {
  console.log("\n=== Local dev logins (same password for all: DEV_LOGIN_PASSWORD in apps/backend/.env) ===\n");
  console.log("  Admin UI: http://localhost:3000/login");
  console.log("  LMS:      http://localhost:3001/login\n");
  for (const line of lines) console.log(`  ${line}`);
  console.log("");
}

/** Caller must have an active mongoose connection. */
export async function seedDevAccounts(password: string): Promise<string[]> {
  const lines: string[] = [];

  const existingSuper = await UserModel.findOne({ roles: ROLE.SUPER_ADMIN }).select("username").exec();
  if (existingSuper) {
    const un = existingSuper.username?.trim();
    lines.push(
      un
        ? `Super Admin — already present — username "${un}" (password not changed; use db:reset-users-dev to wipe users if needed)`
        : `Super Admin — already present — fix username in DB or run db:reset-users-dev`
    );
  } else {
    const r = await createSuperAdmin({
      name: "Dev Super Admin",
      email: DEV_LOCAL_SUPER_EMAIL,
      mobile: "+910000000001",
      password,
    });
    lines.push(`Super Admin — username "${r.username}" — email ${DEV_LOCAL_SUPER_EMAIL}`);
  }

  const existingAdmin = await UserModel.findOne({ email: DEV_LOCAL_ADMIN_EMAIL }).exec();
  if (existingAdmin) {
    lines.push(`Admin — already present — username "${existingAdmin.username}"`);
  } else {
    const r = await createAdmin({
      name: "Dev Admin",
      email: DEV_LOCAL_ADMIN_EMAIL,
      mobile: "+910000000002",
      password,
    });
    lines.push(`Admin — username "${r.username}" — email ${DEV_LOCAL_ADMIN_EMAIL}`);
  }

  const existingStudent = await UserModel.findOne({
    username: DEV_LOCAL_STUDENT_USERNAME,
    roles: ROLE.STUDENT,
  }).exec();
  if (existingStudent) {
    lines.push(`Student — already present — username "${DEV_LOCAL_STUDENT_USERNAME}"`);
  } else {
    await createStudent({
      username: DEV_LOCAL_STUDENT_USERNAME,
      name: "Dev Student",
      email: DEV_LOCAL_STUDENT_EMAIL,
      mobile: "+910000000003",
      password,
      age: 12,
      city: "Dev City",
    });
    lines.push(`Student — username "${DEV_LOCAL_STUDENT_USERNAME}" — email ${DEV_LOCAL_STUDENT_EMAIL}`);
  }

  return lines;
}
