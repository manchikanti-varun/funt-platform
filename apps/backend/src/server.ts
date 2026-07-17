import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { validateEnv, getEnv } from "./config/env.js";
import { initSocketServer } from "./realtime/socketServer.js";

validateEnv();
const { port, mongoUri, isProduction, nodeEnv } = getEnv();

if (!isProduction) {
  console.log(`[server] Development mode (NODE_ENV=${nodeEnv})`);
}

const host = "0.0.0.0";

function listen(): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);

    // Initialize Socket.IO on the same HTTP server
    initSocketServer(server);

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
    // Start the weekly git backup scheduler (if configured)
    const { startBackupScheduler } = await import("./services/gitBackup.service.js");
    startBackupScheduler();
    // Auto-expire overdue offer letters (check every hour)
    const { expireOverdueLetters } = await import("./services/letter.service.js");
    expireOverdueLetters().then((n) => { if (n > 0) console.log(`[letters] Expired ${n} overdue offer letter(s)`); }).catch(() => {});
    setInterval(() => {
      expireOverdueLetters().then((n) => { if (n > 0) console.log(`[letters] Expired ${n} overdue offer letter(s)`); }).catch(() => {});
    }, 60 * 60 * 1000); // every hour

    // Retry failed milestone initializations (check every 5 minutes)
    const { retryPendingMilestoneInits } = await import("./services/learningPlan.service.js");
    retryPendingMilestoneInits().then((n) => { if (n > 0) console.log(`[milestones] Retried ${n} pending milestone init(s)`); }).catch(() => {});
    setInterval(() => {
      retryPendingMilestoneInits().then((n) => { if (n > 0) console.log(`[milestones] Retried ${n} pending milestone init(s)`); }).catch(() => {});
    }, 5 * 60 * 1000); // every 5 minutes

    // Process scheduled milestone unlocks (DATE_BASED / RELATIVE_DATE) every 10 minutes
    const { processAllScheduledUnlocks } = await import("./services/learningPlan.service.js");
    setInterval(() => {
      processAllScheduledUnlocks().catch(() => {});
    }, 10 * 60 * 1000); // every 10 minutes
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

// Graceful shutdown on uncaught errors — log and exit so the process manager can restart.
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err.message);
  if (!isProduction && err.stack) console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[server] Unhandled rejection:", msg);
  if (!isProduction && reason instanceof Error && reason.stack) console.error(reason.stack);
  process.exit(1);
});
