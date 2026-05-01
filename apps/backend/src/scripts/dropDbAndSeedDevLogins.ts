import "dotenv/config";
import mongoose from "mongoose";
import { printDevLoginReport, seedDevAccounts } from "./devLocalAccounts.js";
import { readDevLoginPassword } from "./readDevLoginPassword.js";

const MONGO_URI = process.env.MONGO_URI;

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
  const password = readDevLoginPassword();

  await mongoose.connect(MONGO_URI);
  const dbName = mongoose.connection.db?.databaseName ?? "?";
  console.log(`Dropping database "${dbName}" …`);
  await mongoose.connection.dropDatabase();
  console.log("Seeding local dev accounts …");
  const lines = await seedDevAccounts(password);
  await mongoose.disconnect();

  printDevLoginReport(lines);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
