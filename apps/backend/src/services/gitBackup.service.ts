/**
 * Git Backup Service — automated weekly full database backup to a git repository.
 *
 * Flow:
 *   1. Exports all MongoDB collections as JSON files
 *   2. Writes them into a local backup directory
 *   3. Commits with a timestamped message
 *   4. Pushes to the configured remote backup repo
 *
 * Environment variables:
 *   BACKUP_GIT_REPO_URL    — Remote git repo URL (e.g. https://github.com/org/funt-backup.git)
 *   BACKUP_GIT_BRANCH      — Branch name (default: "main")
 *   BACKUP_GIT_USER_NAME   — Git committer name (default: "FUNT Backup Bot")
 *   BACKUP_GIT_USER_EMAIL  — Git committer email (default: "backup@funt.in")
 *   BACKUP_GIT_TOKEN       — Personal access token for authentication (embedded in URL)
 *   BACKUP_CRON_SCHEDULE   — Cron expression (default: "0 2 * * 0" = every Sunday 2 AM)
 *   BACKUP_ENABLED         — Set to "1" to enable (disabled by default)
 */

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import mongoose from "mongoose";

const execAsync = promisify(exec);

// ─── Configuration ────────────────────────────────────────────────────────────

function getBackupConfig() {
  return {
    enabled: process.env.BACKUP_ENABLED === "1",
    repoUrl: process.env.BACKUP_GIT_REPO_URL ?? "",
    branch: process.env.BACKUP_GIT_BRANCH ?? "main",
    userName: process.env.BACKUP_GIT_USER_NAME ?? "FUNT Backup Bot",
    userEmail: process.env.BACKUP_GIT_USER_EMAIL ?? "backup@funt.in",
    token: process.env.BACKUP_GIT_TOKEN ?? "",
    cronSchedule: process.env.BACKUP_CRON_SCHEDULE ?? "0 2 * * 0", // Sunday 2 AM
  };
}

/** Build the authenticated git URL by embedding the token. */
function getAuthenticatedRepoUrl(repoUrl: string, token: string): string {
  if (!token) return repoUrl;
  try {
    const url = new URL(repoUrl);
    url.username = token;
    url.password = "x-oauth-basic";
    return url.toString();
  } catch {
    // Fallback: insert token into https:// URL
    return repoUrl.replace("https://", `https://${token}@`);
  }
}

// ─── Collections to backup ────────────────────────────────────────────────────

// Exclude large audit/log collections that grow fast and aren't critical for recovery
const EXCLUDED_COLLECTIONS = new Set([
  "auditlogs",       // grows fast, can be regenerated
  "oauthnonces",     // ephemeral
  "sessions",        // ephemeral
]);

// ─── Core backup logic ────────────────────────────────────────────────────────

export async function runFullBackup(): Promise<{ success: boolean; message: string; collections: number; timestamp: string }> {
  const config = getBackupConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (!config.repoUrl) {
    return { success: false, message: "BACKUP_GIT_REPO_URL not configured", collections: 0, timestamp };
  }

  const backupDir = path.join(os.tmpdir(), `funt-backup-${Date.now()}`);

  try {
    // 1. Clone the backup repo (shallow — we only need latest)
    const authUrl = getAuthenticatedRepoUrl(config.repoUrl, config.token);
    await execAsync(`git clone --depth 1 --branch ${config.branch} "${authUrl}" "${backupDir}"`, {
      timeout: 60_000,
    }).catch(async () => {
      // Branch might not exist yet — clone default and create branch
      await fs.mkdir(backupDir, { recursive: true });
      await execAsync(`git init`, { cwd: backupDir });
      await execAsync(`git remote add origin "${authUrl}"`, { cwd: backupDir });
      await execAsync(`git checkout -b ${config.branch}`, { cwd: backupDir });
    });

    // 2. Configure git user
    await execAsync(`git config user.name "${config.userName}"`, { cwd: backupDir });
    await execAsync(`git config user.email "${config.userEmail}"`, { cwd: backupDir });

    // 3. Clear old data files (keep .git)
    const dataDir = path.join(backupDir, "data");
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.mkdir(dataDir, { recursive: true });

    // 4. Export all collections
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const collections = await db.listCollections().toArray();
    let exportedCount = 0;

    for (const col of collections) {
      const name = col.name;
      if (EXCLUDED_COLLECTIONS.has(name.toLowerCase())) continue;

      const docs = await db.collection(name).find({}).toArray();
      const filePath = path.join(dataDir, `${name}.json`);
      await fs.writeFile(filePath, JSON.stringify(docs, null, 2), "utf-8");
      exportedCount++;
    }

    // 5. Write backup metadata
    const meta = {
      platform: "funt",
      backupAt: new Date().toISOString(),
      collections: exportedCount,
      mongoUri: maskUri(process.env.MONGO_URI ?? ""),
      version: "1.0.0",
    };
    await fs.writeFile(path.join(backupDir, "backup-meta.json"), JSON.stringify(meta, null, 2), "utf-8");

    // 6. Git add, commit, push
    await execAsync("git add -A", { cwd: backupDir });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execAsync("git status --porcelain", { cwd: backupDir });
    if (!statusOut.trim()) {
      return { success: true, message: "No changes since last backup", collections: exportedCount, timestamp };
    }

    const commitMsg = `backup: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — ${exportedCount} collections`;
    await execAsync(`git commit -m "${commitMsg}"`, { cwd: backupDir });
    await execAsync(`git push origin ${config.branch} --force`, { cwd: backupDir, timeout: 120_000 });

    console.log(`[backup] ✓ Pushed ${exportedCount} collections to ${config.branch}`);
    return { success: true, message: `Backup pushed: ${exportedCount} collections`, collections: exportedCount, timestamp };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup] Failed:", msg);
    return { success: false, message: msg, collections: 0, timestamp };
  } finally {
    // Cleanup temp directory
    await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Mask the MongoDB URI for safe logging (hide password). */
function maskUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

// ─── Cron Scheduler ───────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Parse a simple cron expression and return the next run time.
 * Supports: minute hour dayOfMonth month dayOfWeek
 */
function getNextCronRun(cronExpr: string): Date {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    // Default to Sunday 2 AM if invalid
    return getNextWeeklyRun(0, 2, 0); // Sunday 2:00 AM
  }

  const [minuteStr, hourStr, , , dayOfWeekStr] = parts;
  const minute = minuteStr === "*" ? 0 : parseInt(minuteStr, 10);
  const hour = hourStr === "*" ? 2 : parseInt(hourStr, 10);
  const dayOfWeek = dayOfWeekStr === "*" ? -1 : parseInt(dayOfWeekStr, 10); // 0=Sunday

  if (dayOfWeek >= 0) {
    return getNextWeeklyRun(dayOfWeek, hour, minute);
  }
  // Daily
  return getNextDailyRun(hour, minute);
}

function getNextWeeklyRun(targetDay: number, hour: number, minute: number): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && now >= next)) {
    daysUntil += 7;
  }
  next.setDate(next.getDate() + daysUntil);
  return next;
}

function getNextDailyRun(hour: number, minute: number): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function startBackupScheduler(): void {
  const config = getBackupConfig();
  if (!config.enabled) {
    console.log("[backup] Backup scheduler disabled (set BACKUP_ENABLED=1 to enable)");
    return;
  }
  if (!config.repoUrl) {
    console.log("[backup] Backup scheduler disabled — BACKUP_GIT_REPO_URL not set");
    return;
  }

  scheduleNextRun(config.cronSchedule);
  console.log(`[backup] Scheduler started — cron: "${config.cronSchedule}"`);
}

function scheduleNextRun(cronExpr: string): void {
  const nextRun = getNextCronRun(cronExpr);
  const delay = nextRun.getTime() - Date.now();

  console.log(`[backup] Next backup scheduled at: ${nextRun.toLocaleString("en-IN")}`);

  schedulerTimer = setTimeout(async () => {
    console.log("[backup] Running scheduled backup...");
    await runFullBackup();
    // Schedule the next run
    scheduleNextRun(cronExpr);
  }, delay);
}

export function stopBackupScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    console.log("[backup] Scheduler stopped");
  }
}
