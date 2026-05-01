/**
 * Creates a single Super Admin from SUPER_ADMIN_* env vars if none exists.
 * For local development with fixed Super Admin + Admin + Student, use:
 *   DEV_LOGIN_SEED_CONFIRM=1 npm run seed:dev-logins
 * (see devLocalAccounts.ts).
 */
import "dotenv/config";
import mongoose from "mongoose";
import { createSuperAdmin } from "../services/auth.service.js";
import { UserModel } from "../models/User.model.js";
import { ROLE } from "@funt-platform/constants";

const MONGO_URI = process.env.MONGO_URI;
const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";
const mobile = process.env.SUPER_ADMIN_MOBILE ?? "+910000000000";

async function seed(): Promise<void> {
  if (!MONGO_URI || !email || !password) {
    console.error("Set MONGO_URI, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const existing = await UserModel.findOne({ roles: ROLE.SUPER_ADMIN }).exec();
  if (existing) {
    console.log("Super Admin already exists:", existing.username);
    await mongoose.disconnect();
    process.exit(0);
  }
  const result = await createSuperAdmin({ name, email, mobile, password });
  console.log("Super Admin created:", result.username, result.id);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
