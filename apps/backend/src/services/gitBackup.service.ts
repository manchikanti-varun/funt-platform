/**
 * Git Backup Service — automated weekly full database backup to a git repository.
 *
 * Uses the GitHub REST API (no git CLI required) — works in containers without git installed.
 *
 * Flow:
 *   1. Exports all MongoDB collections as JSON files
 *   2. Creates a git tree via GitHub API
 *   3. Commits and updates the branch ref
 *
 * Environment variables:
 *   BACKUP_GIT_REPO_URL    — Remote git repo URL (e.g. https://github.com/org/funt-backup.git)
 *   BACKUP_GIT_BRANCH      — Branch name (default: "main")
 *   BACKUP_GIT_USER_NAME   — Git committer name (default: "FUNT Backup Bot")
 *   BACKUP_GIT_USER_EMAIL  — Git committer email (default: "backup@funt.in")
 *   BACKUP_GIT_TOKEN       — GitHub Personal Access Token (fine-grained, Contents: read+write)
 *   BACKUP_CRON_SCHEDULE   — Cron expression (default: "0 2 * * 0" = every Sunday 2 AM)
 *   BACKUP_ENABLED         — Set to "1" to enable (disabled by default)
 */

import mongoose from "mongoose";

// ─── Configuration ────────────────────────────────────────────────────────────

function getBackupConfig() {
  return {
    enabled: process.env.BACKUP_ENABLED === "1",
    repoUrl: process.env.BACKUP_GIT_REPO_URL ?? "",
    branch: process.env.BACKUP_GIT_BRANCH ?? "main",
    userName: process.env.BACKUP_GIT_USER_NAME ?? "FUNT Backup Bot",
    userEmail: process.env.BACKUP_GIT_USER_EMAIL ?? "backup@funt.in",
    token: process.env.BACKUP_GIT_TOKEN ?? "",
    cronSchedule: process.env.BACKUP_CRON_SCHEDULE ?? "0 2 * * 0",
  };
}

/** Extract owner/repo from a GitHub URL like https://github.com/owner/repo.git */
function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

async function githubApi(
  endpoint: string,
  token: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ─── Collections to backup ────────────────────────────────────────────────────

const EXCLUDED_COLLECTIONS = new Set([
  "auditlogs",
  "oauthnonces",
  "sessions",
]);

// ─── Core backup logic ────────────────────────────────────────────────────────

export async function runFullBackup(): Promise<{ success: boolean; message: string; collections: number; timestamp: string }> {
  const config = getBackupConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (!config.repoUrl) {
    return { success: false, message: "BACKUP_GIT_REPO_URL not configured", collections: 0, timestamp };
  }
  if (!config.token) {
    return { success: false, message: "BACKUP_GIT_TOKEN not configured", collections: 0, timestamp };
  }

  const parsed = parseGitHubRepo(config.repoUrl);
  if (!parsed) {
    return { success: false, message: "Invalid GitHub repo URL format", collections: 0, timestamp };
  }
  const { owner, repo } = parsed;

  try {
    // 1. Export all collections from MongoDB
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const collections = await db.listCollections().toArray();
    const files: Array<{ path: string; content: string }> = [];
    let exportedCount = 0;

    for (const col of collections) {
      const name = col.name;
      if (EXCLUDED_COLLECTIONS.has(name.toLowerCase())) continue;

      const docs = await db.collection(name).find({}).toArray();
      files.push({
        path: `data/${name}.json`,
        content: JSON.stringify(docs, null, 2),
      });
      exportedCount++;
    }

    // Add backup metadata
    const meta = {
      platform: "funt",
      backupAt: new Date().toISOString(),
      collections: exportedCount,
      mongoUri: maskUri(process.env.MONGO_URI ?? ""),
      version: "1.0.0",
    };
    files.push({
      path: "backup-meta.json",
      content: JSON.stringify(meta, null, 2),
    });

    // 2. Get the current commit SHA on the branch (if exists)
    const refRes = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/${config.branch}`, config.token);
    const parentSha: string | null = refRes.ok
      ? ((refRes.data as { object: { sha: string } }).object.sha ?? null)
      : null;

    // 3. Create blobs for each file
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    for (const file of files) {
      const blobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs`, config.token, {
        method: "POST",
        body: { content: file.content, encoding: "utf-8" },
      });
      if (!blobRes.ok) {
        throw new Error(`Failed to create blob for ${file.path}: ${JSON.stringify(blobRes.data)}`);
      }
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: (blobRes.data as { sha: string }).sha,
      });
    }

    // 4. Create a tree
    const treeBody: { tree: typeof treeItems; base_tree?: string } = { tree: treeItems };
    if (parentSha) {
      // Get the tree SHA of the parent commit
      const commitRes = await githubApi(`/repos/${owner}/${repo}/git/commits/${parentSha}`, config.token);
      if (commitRes.ok) {
        treeBody.base_tree = (commitRes.data as { tree: { sha: string } }).tree.sha;
      }
    }

    const treeRes = await githubApi(`/repos/${owner}/${repo}/git/trees`, config.token, {
      method: "POST",
      body: treeBody,
    });
    if (!treeRes.ok) {
      throw new Error(`Failed to create tree: ${JSON.stringify(treeRes.data)}`);
    }
    const treeSha = (treeRes.data as { sha: string }).sha;

    // 5. Create a commit
    const commitMsg = `backup: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — ${exportedCount} collections`;
    const commitBody: {
      message: string;
      tree: string;
      parents: string[];
      author: { name: string; email: string; date: string };
    } = {
      message: commitMsg,
      tree: treeSha,
      parents: parentSha ? [parentSha] : [],
      author: {
        name: config.userName,
        email: config.userEmail,
        date: new Date().toISOString(),
      },
    };

    const commitRes = await githubApi(`/repos/${owner}/${repo}/git/commits`, config.token, {
      method: "POST",
      body: commitBody,
    });
    if (!commitRes.ok) {
      throw new Error(`Failed to create commit: ${JSON.stringify(commitRes.data)}`);
    }
    const newCommitSha = (commitRes.data as { sha: string }).sha;

    // 6. Update the branch ref (or create it)
    if (parentSha) {
      const updateRes = await githubApi(`/repos/${owner}/${repo}/git/refs/heads/${config.branch}`, config.token, {
        method: "PATCH",
        body: { sha: newCommitSha, force: true },
      });
      if (!updateRes.ok) {
        throw new Error(`Failed to update ref: ${JSON.stringify(updateRes.data)}`);
      }
    } else {
      const createRes = await githubApi(`/repos/${owner}/${repo}/git/refs`, config.token, {
        method: "POST",
        body: { ref: `refs/heads/${config.branch}`, sha: newCommitSha },
      });
      if (!createRes.ok) {
        throw new Error(`Failed to create ref: ${JSON.stringify(createRes.data)}`);
      }
    }

    console.log(`[backup] ✓ Pushed ${exportedCount} collections to ${owner}/${repo}@${config.branch}`);
    return { success: true, message: `Backup pushed: ${exportedCount} collections`, collections: exportedCount, timestamp };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup] Failed:", msg);
    return { success: false, message: msg, collections: 0, timestamp };
  }
}

/** Mask the MongoDB URI for safe logging (hide password). */
function maskUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

// ─── Cron Scheduler ───────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

function getNextCronRun(cronExpr: string): Date {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return getNextWeeklyRun(0, 2, 0);
  }

  const [minuteStr, hourStr, , , dayOfWeekStr] = parts;
  const minute = minuteStr === "*" ? 0 : parseInt(minuteStr, 10);
  const hour = hourStr === "*" ? 2 : parseInt(hourStr, 10);
  const dayOfWeek = dayOfWeekStr === "*" ? -1 : parseInt(dayOfWeekStr, 10);

  if (dayOfWeek >= 0) {
    return getNextWeeklyRun(dayOfWeek, hour, minute);
  }
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
