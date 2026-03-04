
import mongoose from "mongoose";

export async function connectDb(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri);
    console.log("[db] MongoDB connected successfully");
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err);
    process.exit(1);
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  console.log("[db] MongoDB disconnected");
}
