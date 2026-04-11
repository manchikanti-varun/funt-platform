import "dotenv/config";
import mongoose from "mongoose";
import { seedDevAccounts } from "./seedDevAccounts.js";

const MONGO_URI = process.env.MONGO_URI;
const password =
  process.env.DEV_LOGIN_PASSWORD?.trim() ||
  process.env.SEED_DEV_PASSWORD?.trim() ||
  "";

async function seed(): Promise<void> {
  if (!MONGO_URI) {
    console.error("Set MONGO_URI in apps/backend/.env");
    process.exit(1);
  }
  if (process.env.DEV_LOGIN_SEED_CONFIRM !== "1") {
    console.error(
      "Refusing to run: set DEV_LOGIN_SEED_CONFIRM=1 to confirm you intend to seed the database in MONGO_URI (never run against production by mistake)."
    );
    process.exit(1);
  }
  if (!password) {
    console.error(
      "Set DEV_LOGIN_PASSWORD (or SEED_DEV_PASSWORD) in apps/backend/.env — local dev only; never use weak passwords in production."
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const lines = await seedDevAccounts(password);
  await mongoose.disconnect();

  console.log("\n--- Dev logins (Admin: http://localhost:3000  LMS: http://localhost:3001) ---\n");
  for (const line of lines) console.log(line);
  console.log("");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
