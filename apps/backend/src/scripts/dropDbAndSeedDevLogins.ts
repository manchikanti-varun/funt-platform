import "dotenv/config";
import mongoose from "mongoose";
import { seedDevAccounts } from "./seedDevAccounts.js";

const MONGO_URI = process.env.MONGO_URI;
const password =
  process.env.DEV_LOGIN_PASSWORD?.trim() ||
  process.env.SEED_DEV_PASSWORD?.trim() ||
  "";

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error("Set MONGO_URI in apps/backend/.env");
    process.exit(1);
  }
  if (process.env.CONFIRM_DROP_DB_AND_RESEED !== "DROP_ALL_DATA_AND_RESEED") {
    console.error(
      'Refusing: this deletes every collection in the database from MONGO_URI. Set CONFIRM_DROP_DB_AND_RESEED=DROP_ALL_DATA_AND_RESEED (exact string) plus DEV_LOGIN_PASSWORD.'
    );
    process.exit(1);
  }
  if (!password) {
    console.error("Set DEV_LOGIN_PASSWORD (or SEED_DEV_PASSWORD).");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const dbName = mongoose.connection.db?.databaseName ?? "?";
  console.log(`Dropping database "${dbName}" …`);
  await mongoose.connection.dropDatabase();
  console.log("Seeding dev accounts …");
  const lines = await seedDevAccounts(password);
  await mongoose.disconnect();

  console.log("\n--- Dev logins (Admin: http://localhost:3000  LMS: http://localhost:3001) ---\n");
  for (const line of lines) console.log(line);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
