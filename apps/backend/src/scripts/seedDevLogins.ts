import "dotenv/config";
import mongoose from "mongoose";
import { printDevLoginReport, seedDevAccounts } from "./devLocalAccounts.js";
import { readDevLoginPassword } from "./readDevLoginPassword.js";

const MONGO_URI = process.env.MONGO_URI;

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
  const password = readDevLoginPassword();

  await mongoose.connect(MONGO_URI);
  const lines = await seedDevAccounts(password);
  await mongoose.disconnect();

  printDevLoginReport(lines);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
