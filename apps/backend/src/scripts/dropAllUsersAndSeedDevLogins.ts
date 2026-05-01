import "dotenv/config";
import mongoose from "mongoose";
import { UserModel } from "../models/User.model.js";
import { printDevLoginReport, seedDevAccounts } from "./devLocalAccounts.js";
import { readDevLoginPassword } from "./readDevLoginPassword.js";

const MONGO_URI = process.env.MONGO_URI;

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error("Set MONGO_URI in apps/backend/.env");
    process.exit(1);
  }
  if (process.env.CONFIRM_DELETE_ALL_USERS_AND_RESEED !== "DELETE_ALL_USERS_AND_RESEED") {
    console.error(
      'Refusing: this deletes every document in the User collection for MONGO_URI. Set CONFIRM_DELETE_ALL_USERS_AND_RESEED=DELETE_ALL_USERS_AND_RESEED (exact string) plus DEV_LOGIN_PASSWORD. Use only on dev databases.'
    );
    process.exit(1);
  }
  const password = readDevLoginPassword();

  await mongoose.connect(MONGO_URI);
  const dbName = mongoose.connection.db?.databaseName ?? "?";
  const before = await UserModel.countDocuments({});
  console.log(`Database "${dbName}": deleting ${before} user document(s) …`);
  await UserModel.deleteMany({});
  console.log(
    "Note: enrollments, submissions, and other collections may still reference old user IDs until you clean them or use db:reset-dev."
  );
  console.log("Seeding local dev accounts …");
  const lines = await seedDevAccounts(password);
  await mongoose.disconnect();

  printDevLoginReport(lines);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
