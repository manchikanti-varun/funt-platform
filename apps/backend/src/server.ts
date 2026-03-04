/**
 * Server bootstrap: bind port first, then DB.
 * Uses http.createServer + reuseAddress so we can bind after port was freed (TIME_WAIT).
 */

import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { validateEnv, getEnv } from "./config/env.js";

validateEnv();
const { port, mongoUri, isProduction } = getEnv();

const host = "0.0.0.0";

function listen(): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.on("error", reject);
    server.listen(
      { port: Number(port), host, reuseAddress: true },
      () => {
        console.log(`[server] Backend running at http://localhost:${port}`);
        resolve(server);
      }
    );
  });
}

async function start(): Promise<void> {
  const server = await listen();
  try {
    await connectDb(mongoUri);
  } catch (err) {
    server.close();
    throw err;
  }
}

start().catch((err) => {
  if (isProduction) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[server] Startup failed:", msg.replace(/mongodb(\+srv)?:\/\/[^@]+@/i, "mongodb***@"));
  } else {
    console.error("[server] Startup failed:", err);
  }
  process.exit(1);
});
