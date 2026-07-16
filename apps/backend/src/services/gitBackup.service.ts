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

// ─── R2 Media Link Collection ─────────────────────────────────────────────────

interface R2MediaLink {
  key: string;           // e.g. "r2://courses/abc/mod/lesson.mp4"
  source: string;        // collection name
  documentId: string;    // _id of the document
  field: string;         // which field holds the R2 URL
  context?: string;      // extra info (e.g. module title, course title)
}

interface R2MediaSummary {
  collectedAt: string;
  totalLinks: number;
  bySource: Record<string, number>;
  links: R2MediaLink[];
}

const R2_PREFIX = "r2://";

/**
 * Scan relevant MongoDB collections for all R2 media links (videos, images, proofs).
 * Returns a structured summary of every R2 reference found in the database.
 */
async function collectR2MediaLinks(db: mongoose.mongo.Db): Promise<R2MediaSummary> {
  const links: R2MediaLink[] = [];

  // 1. GlobalModules — videoUrl and r2:// images in content HTML
  const globalModules = await db.collection("globalmodules").find({}).toArray();
  for (const doc of globalModules) {
    if (doc.videoUrl && String(doc.videoUrl).startsWith(R2_PREFIX)) {
      links.push({
        key: String(doc.videoUrl),
        source: "globalmodules",
        documentId: String(doc._id),
        field: "videoUrl",
        context: doc.title ? String(doc.title) : undefined,
      });
    }
    // Check version snapshots for video URLs
    if (Array.isArray(doc.versionSnapshots)) {
      for (const snap of doc.versionSnapshots) {
        if (snap.videoUrl && String(snap.videoUrl).startsWith(R2_PREFIX)) {
          links.push({
            key: String(snap.videoUrl),
            source: "globalmodules",
            documentId: String(doc._id),
            field: `versionSnapshots[v${snap.version}].videoUrl`,
            context: doc.title ? `${String(doc.title)} (snapshot v${snap.version})` : undefined,
          });
        }
      }
    }
    // Check content HTML for embedded r2:// images
    if (doc.content) {
      extractR2LinksFromHtml(String(doc.content), "globalmodules", String(doc._id), "content", links, doc.title ? String(doc.title) : undefined);
    }
  }

  // 2. Courses — module snapshots videoUrl and content
  const courses = await db.collection("courses").find({}).toArray();
  for (const doc of courses) {
    // Course header image
    if (doc.headerImageUrl && String(doc.headerImageUrl).startsWith(R2_PREFIX)) {
      links.push({
        key: String(doc.headerImageUrl),
        source: "courses",
        documentId: String(doc._id),
        field: "headerImageUrl",
        context: doc.title ? String(doc.title) : undefined,
      });
    }
    // Module snapshots
    if (Array.isArray(doc.modules)) {
      for (let i = 0; i < doc.modules.length; i++) {
        const m = doc.modules[i];
        if (m.videoUrl && String(m.videoUrl).startsWith(R2_PREFIX)) {
          links.push({
            key: String(m.videoUrl),
            source: "courses",
            documentId: String(doc._id),
            field: `modules[${i}].videoUrl`,
            context: doc.title ? `${String(doc.title)} → ${m.title || `module ${i}`}` : undefined,
          });
        }
        if (m.content) {
          extractR2LinksFromHtml(String(m.content), "courses", String(doc._id), `modules[${i}].content`, links, doc.title ? String(doc.title) : undefined);
        }
      }
    }
  }

  // 3. Batches — course snapshots within batches
  const batches = await db.collection("batches").find({}).toArray();
  for (const doc of batches) {
    if (doc.headerImageUrl && String(doc.headerImageUrl).startsWith(R2_PREFIX)) {
      links.push({
        key: String(doc.headerImageUrl),
        source: "batches",
        documentId: String(doc._id),
        field: "headerImageUrl",
        context: doc.name ? String(doc.name) : undefined,
      });
    }
    const snapshots = doc.courseSnapshots ?? [];
    if (Array.isArray(snapshots)) {
      for (let s = 0; s < snapshots.length; s++) {
        const snap = snapshots[s];
        if (snap.headerImageUrl && String(snap.headerImageUrl).startsWith(R2_PREFIX)) {
          links.push({
            key: String(snap.headerImageUrl),
            source: "batches",
            documentId: String(doc._id),
            field: `courseSnapshots[${s}].headerImageUrl`,
            context: doc.name ? String(doc.name) : undefined,
          });
        }
        if (Array.isArray(snap.modules)) {
          for (let i = 0; i < snap.modules.length; i++) {
            const m = snap.modules[i];
            if (m.videoUrl && String(m.videoUrl).startsWith(R2_PREFIX)) {
              links.push({
                key: String(m.videoUrl),
                source: "batches",
                documentId: String(doc._id),
                field: `courseSnapshots[${s}].modules[${i}].videoUrl`,
                context: doc.name ? `${String(doc.name)} → ${m.title || `module ${i}`}` : undefined,
              });
            }
          }
        }
      }
    }
  }

  // 4. FranchiseKeyPools — payment proof URLs
  const franchiseKeyPools = await db.collection("franchisekeypools").find({}).toArray();
  for (const doc of franchiseKeyPools) {
    if (Array.isArray(doc.requests)) {
      for (let i = 0; i < doc.requests.length; i++) {
        const req = doc.requests[i];
        if (req.paymentProofUrl && String(req.paymentProofUrl).startsWith(R2_PREFIX)) {
          links.push({
            key: String(req.paymentProofUrl),
            source: "franchisekeypools",
            documentId: String(doc._id),
            field: `requests[${i}].paymentProofUrl`,
          });
        }
      }
    }
  }

  // 5. ShopProducts — imageUrl
  const shopProducts = await db.collection("shopproducts").find({}).toArray();
  for (const doc of shopProducts) {
    if (doc.imageUrl && String(doc.imageUrl).startsWith(R2_PREFIX)) {
      links.push({
        key: String(doc.imageUrl),
        source: "shopproducts",
        documentId: String(doc._id),
        field: "imageUrl",
        context: doc.name ? String(doc.name) : undefined,
      });
    }
  }

  // 6. BadgeTypeDefinitions — imageUrl
  const badges = await db.collection("badgetypedefinitions").find({}).toArray();
  for (const doc of badges) {
    if (doc.imageUrl && String(doc.imageUrl).startsWith(R2_PREFIX)) {
      links.push({
        key: String(doc.imageUrl),
        source: "badgetypedefinitions",
        documentId: String(doc._id),
        field: "imageUrl",
        context: doc.badgeType ? String(doc.badgeType) : undefined,
      });
    }
  }

  // 7. Quizzes — question/option imageUrls
  const quizzes = await db.collection("quizzes").find({}).toArray();
  for (const doc of quizzes) {
    if (Array.isArray(doc.questions)) {
      for (let q = 0; q < doc.questions.length; q++) {
        const question = doc.questions[q];
        if (question.imageUrl && String(question.imageUrl).startsWith(R2_PREFIX)) {
          links.push({
            key: String(question.imageUrl),
            source: "quizzes",
            documentId: String(doc._id),
            field: `questions[${q}].imageUrl`,
            context: doc.title ? String(doc.title) : undefined,
          });
        }
        if (Array.isArray(question.options)) {
          for (let o = 0; o < question.options.length; o++) {
            if (question.options[o].imageUrl && String(question.options[o].imageUrl).startsWith(R2_PREFIX)) {
              links.push({
                key: String(question.options[o].imageUrl),
                source: "quizzes",
                documentId: String(doc._id),
                field: `questions[${q}].options[${o}].imageUrl`,
                context: doc.title ? String(doc.title) : undefined,
              });
            }
          }
        }
      }
    }
  }

  // 8. KnowledgeArticles — content (rich text HTML with embedded R2 images/videos)
  const articles = await db.collection("knowledgearticles").find({}).toArray();
  for (const doc of articles) {
    if (doc.content) {
      extractR2LinksFromHtml(String(doc.content), "knowledgearticles", String(doc._id), "content", links, doc.title ? String(doc.title) : undefined);
    }
  }

  // 9. GlobalAssignments — instructions (rich text HTML)
  const globalAssignments = await db.collection("globalassignments").find({}).toArray();
  for (const doc of globalAssignments) {
    if (doc.instructions) {
      extractR2LinksFromHtml(String(doc.instructions), "globalassignments", String(doc._id), "instructions", links, doc.title ? String(doc.title) : undefined);
    }
  }

  // 10. Batches — courseSnapshot module content (rich text HTML with embedded R2 media)
  for (const doc of batches) {
    const snapshots = doc.courseSnapshots ?? [];
    if (Array.isArray(snapshots)) {
      for (let s = 0; s < snapshots.length; s++) {
        const snap = snapshots[s];
        if (Array.isArray(snap.modules)) {
          for (let i = 0; i < snap.modules.length; i++) {
            const m = snap.modules[i];
            if (m.content) {
              extractR2LinksFromHtml(String(m.content), "batches", String(doc._id), `courseSnapshots[${s}].modules[${i}].content`, links, doc.name ? String(doc.name) : undefined);
            }
          }
        }
      }
    }
  }

  // 11. AssignmentSubmissions — submissionContent (may contain embedded R2 media)
  const assignmentSubmissions = await db.collection("assignmentsubmissions").find({}).toArray();
  for (const doc of assignmentSubmissions) {
    if (doc.submissionContent) {
      extractR2LinksFromHtml(String(doc.submissionContent), "assignmentsubmissions", String(doc._id), "submissionContent", links);
    }
  }

  // 12. GlobalAssignmentSubmissions — submissionContent (may contain embedded R2 media)
  const globalAssignmentSubmissions = await db.collection("globalassignmentsubmissions").find({}).toArray();
  for (const doc of globalAssignmentSubmissions) {
    if (doc.submissionContent) {
      extractR2LinksFromHtml(String(doc.submissionContent), "globalassignmentsubmissions", String(doc._id), "submissionContent", links);
    }
  }

  // Build summary
  const bySource: Record<string, number> = {};
  for (const link of links) {
    bySource[link.source] = (bySource[link.source] ?? 0) + 1;
  }

  return {
    collectedAt: new Date().toISOString(),
    totalLinks: links.length,
    bySource,
    links,
  };
}

/** Extract r2:// URLs from HTML content (images embedded via rich text editor). */
function extractR2LinksFromHtml(
  html: string,
  source: string,
  documentId: string,
  field: string,
  links: R2MediaLink[],
  context?: string
): void {
  // Match r2:// URLs in src attributes (images and videos)
  const r2Regex = /(?:src|poster)=["'](r2:\/\/[^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = r2Regex.exec(html)) !== null) {
    links.push({
      key: match[1],
      source,
      documentId,
      field: `${field} (embedded)`,
      context,
    });
  }
}

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

    // ── Collect all R2 media links across the platform ──────────────────────
    const r2Links = await collectR2MediaLinks(db);
    files.push({
      path: "r2-media-links.json",
      content: JSON.stringify(r2Links, null, 2),
    });

    // Add backup metadata
    const meta = {
      platform: "funt",
      backupAt: new Date().toISOString(),
      collections: exportedCount,
      mongoUri: maskUri(process.env.MONGO_URI ?? ""),
      version: "1.0.0",
      r2MediaCount: r2Links.totalLinks,
    };
    files.push({
      path: "backup-meta.json",
      content: JSON.stringify(meta, null, 2),
    });

    // 2. Get the current commit SHA on the branch (if exists)
    const refRes = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/${config.branch}`, config.token);
    let parentSha: string | null = refRes.ok
      ? ((refRes.data as { object: { sha: string } }).object.sha ?? null)
      : null;

    // If repo is empty (no commits), create an initial commit with a README
    if (!parentSha) {
      // Create initial blob
      const initBlobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs`, config.token, {
        method: "POST",
        body: { content: Buffer.from("# FUNT Platform Backup\n\nAutomated database backups.\n", "utf-8").toString("base64"), encoding: "base64" },
      });
      if (!initBlobRes.ok) {
        // Repo might need to be initialized via the API first
        // Try creating a file via the Contents API which auto-initializes the repo
        const initFileRes = await githubApi(`/repos/${owner}/${repo}/contents/README.md`, config.token, {
          method: "PUT",
          body: {
            message: "init: initialize backup repository",
            content: Buffer.from("# FUNT Platform Backup\n\nAutomated database backups.\n").toString("base64"),
            branch: config.branch,
          },
        });
        if (!initFileRes.ok) {
          throw new Error(`Failed to initialize empty repo: ${JSON.stringify(initFileRes.data)}`);
        }
        // Re-fetch the ref after initialization
        const refRetry = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/${config.branch}`, config.token);
        if (!refRetry.ok) {
          throw new Error("Failed to get branch ref after repo initialization");
        }
        parentSha = (refRetry.data as { object: { sha: string } }).object.sha;
      } else {
        // Blob created successfully — create tree, commit, and ref manually
        const initTreeRes = await githubApi(`/repos/${owner}/${repo}/git/trees`, config.token, {
          method: "POST",
          body: { tree: [{ path: "README.md", mode: "100644", type: "blob", sha: (initBlobRes.data as { sha: string }).sha }] },
        });
        if (!initTreeRes.ok) throw new Error("Failed to create initial tree");
        
        const initCommitRes = await githubApi(`/repos/${owner}/${repo}/git/commits`, config.token, {
          method: "POST",
          body: {
            message: "init: initialize backup repository",
            tree: (initTreeRes.data as { sha: string }).sha,
            parents: [],
            author: { name: config.userName, email: config.userEmail, date: new Date().toISOString() },
          },
        });
        if (!initCommitRes.ok) throw new Error("Failed to create initial commit");
        
        const initRefRes = await githubApi(`/repos/${owner}/${repo}/git/refs`, config.token, {
          method: "POST",
          body: { ref: `refs/heads/${config.branch}`, sha: (initCommitRes.data as { sha: string }).sha },
        });
        if (!initRefRes.ok) throw new Error("Failed to create initial branch ref");
        
        parentSha = (initCommitRes.data as { sha: string }).sha;
      }
    }

    // 3. Create blobs for each file (batch small files to reduce API calls)
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    // Process files in parallel batches of 5 to speed things up
    const BATCH_SIZE = 5;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const blobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs`, config.token, {
            method: "POST",
            body: { content: Buffer.from(file.content, "utf-8").toString("base64"), encoding: "base64" },
          });
          if (!blobRes.ok) {
            throw new Error(`Failed to create blob for ${file.path}: ${JSON.stringify(blobRes.data)}`);
          }
          return {
            path: file.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: (blobRes.data as { sha: string }).sha,
          };
        })
      );
      treeItems.push(...results);
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

// ─── Restore from Backup ─────────────────────────────────────────────────────

export interface RestoreResult {
  success: boolean;
  message: string;
  collections: number;
  r2MediaLinks: number;
  timestamp: string;
  skipped: string[];
  errors: Array<{ collection: string; message: string }>;
}

/**
 * Collections that should NEVER be overwritten during restore to avoid
 * losing active sessions, security data, and admin accounts.
 */
const RESTORE_PROTECTED_COLLECTIONS = new Set([
  "sessions",
  "oauthnonces",
  "users",
  "registrationrequests",
]);

/**
 * Restore the database from the latest backup in the configured GitHub repository.
 *
 * Flow:
 *   1. Fetches the file tree from the latest commit on the backup branch
 *   2. Downloads each data/{collection}.json blob
 *   3. Drops and re-inserts each collection (except protected ones)
 *   4. Returns restore summary including R2 media link count
 *
 * WARNING: This is a destructive operation — it replaces all data in the
 * target collections with the backup data.
 */
export async function restoreFromGitBackup(): Promise<RestoreResult> {
  const config = getBackupConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (!config.repoUrl) {
    return { success: false, message: "BACKUP_GIT_REPO_URL not configured", collections: 0, r2MediaLinks: 0, timestamp, skipped: [], errors: [] };
  }
  if (!config.token) {
    return { success: false, message: "BACKUP_GIT_TOKEN not configured", collections: 0, r2MediaLinks: 0, timestamp, skipped: [], errors: [] };
  }

  const parsed = parseGitHubRepo(config.repoUrl);
  if (!parsed) {
    return { success: false, message: "Invalid GitHub repo URL format", collections: 0, r2MediaLinks: 0, timestamp, skipped: [], errors: [] };
  }
  const { owner, repo } = parsed;

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    // 1. Get the latest commit tree
    const refRes = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/${config.branch}`, config.token);
    if (!refRes.ok) {
      throw new Error("No backup found — branch does not exist");
    }
    const commitSha = (refRes.data as { object: { sha: string } }).object.sha;

    const commitRes = await githubApi(`/repos/${owner}/${repo}/git/commits/${commitSha}`, config.token);
    if (!commitRes.ok) throw new Error("Failed to read latest commit");
    const treeSha = (commitRes.data as { tree: { sha: string } }).tree.sha;

    // 2. Get the full tree (recursive) to find all data/*.json files
    const treeRes = await githubApi(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, config.token);
    if (!treeRes.ok) throw new Error("Failed to read backup tree");

    const treeEntries = (treeRes.data as { tree: Array<{ path: string; sha: string; type: string }> }).tree;
    const dataFiles = treeEntries.filter(
      (e) => e.type === "blob" && e.path.startsWith("data/") && e.path.endsWith(".json")
    );

    if (dataFiles.length === 0) {
      throw new Error("No data files found in backup — the repo may be empty or corrupted");
    }

    // 3. Download and restore each collection
    const skipped: string[] = [];
    const errors: RestoreResult["errors"] = [];
    let restoredCount = 0;

    for (const file of dataFiles) {
      const collectionName = file.path.replace("data/", "").replace(".json", "");

      if (RESTORE_PROTECTED_COLLECTIONS.has(collectionName.toLowerCase())) {
        skipped.push(collectionName);
        continue;
      }

      try {
        // Fetch the blob content
        const blobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs/${file.sha}`, config.token);
        if (!blobRes.ok) {
          errors.push({ collection: collectionName, message: "Failed to download blob" });
          continue;
        }

        const blobData = blobRes.data as { content: string; encoding: string };
        const content = blobData.encoding === "base64"
          ? Buffer.from(blobData.content, "base64").toString("utf-8")
          : blobData.content;

        const docs = JSON.parse(content);
        if (!Array.isArray(docs)) {
          errors.push({ collection: collectionName, message: "Invalid format — expected an array" });
          continue;
        }

        // Drop the existing collection and re-insert
        const existing = await db.listCollections({ name: collectionName }).toArray();
        if (existing.length > 0) {
          await db.collection(collectionName).drop();
        }

        if (docs.length > 0) {
          // MongoDB _id fields stored as { $oid: "..." } need conversion
          const processedDocs = docs.map(convertBackupDoc) as Record<string, unknown>[];
          await db.collection(collectionName).insertMany(processedDocs, { ordered: false });
        }

        restoredCount++;
      } catch (err) {
        errors.push({ collection: collectionName, message: err instanceof Error ? err.message : String(err) });
      }
    }

    // 4. Check for R2 media links file
    let r2MediaLinks = 0;
    const r2File = treeEntries.find((e) => e.path === "r2-media-links.json");
    if (r2File) {
      try {
        const blobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs/${r2File.sha}`, config.token);
        if (blobRes.ok) {
          const blobData = blobRes.data as { content: string; encoding: string };
          const content = blobData.encoding === "base64"
            ? Buffer.from(blobData.content, "base64").toString("utf-8")
            : blobData.content;
          const r2Summary = JSON.parse(content);
          r2MediaLinks = r2Summary.totalLinks ?? 0;
        }
      } catch { /* non-critical — r2 link count is informational */ }
    }

    console.log(`[restore] ✓ Restored ${restoredCount} collections from ${owner}/${repo}@${config.branch}`);
    return {
      success: true,
      message: `Restored ${restoredCount} collections (${skipped.length} skipped, ${errors.length} errors). ${r2MediaLinks} R2 media links preserved in data.`,
      collections: restoredCount,
      r2MediaLinks,
      timestamp,
      skipped,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[restore] Failed:", msg);
    return { success: false, message: msg, collections: 0, r2MediaLinks: 0, timestamp, skipped: [], errors: [] };
  }
}

/**
 * Restore from uploaded backup data (JSON payload).
 *
 * Accepts the same structure as the git backup: { collections: { [name]: docs[] } }
 * This allows restoring from a downloaded backup without needing GitHub access.
 */
export async function restoreFromUpload(
  data: Record<string, unknown[]>,
  options?: { skipCollections?: string[] }
): Promise<RestoreResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const skipped: string[] = [];
    const errors: RestoreResult["errors"] = [];
    let restoredCount = 0;
    const skipSet = new Set([
      ...RESTORE_PROTECTED_COLLECTIONS,
      ...(options?.skipCollections ?? []).map((s) => s.toLowerCase()),
    ]);

    // Allowed collection names — only application-level collections can be restored.
    // Prevents injection into MongoDB system collections or other sensitive targets.
    const ALLOWED_COLLECTION_PATTERN = /^[a-z][a-z0-9_-]{1,60}$/i;
    const BLOCKED_PREFIXES = ["system.", "admin.", "config.", "local."];

    for (const [collectionName, docs] of Object.entries(data)) {
      // Validate collection name format
      if (!ALLOWED_COLLECTION_PATTERN.test(collectionName) || BLOCKED_PREFIXES.some((p) => collectionName.toLowerCase().startsWith(p))) {
        errors.push({ collection: collectionName, message: "Invalid or disallowed collection name" });
        continue;
      }

      if (skipSet.has(collectionName.toLowerCase())) {
        skipped.push(collectionName);
        continue;
      }

      if (!Array.isArray(docs)) {
        errors.push({ collection: collectionName, message: "Expected an array of documents" });
        continue;
      }

      if (docs.length > 100_000) {
        errors.push({ collection: collectionName, message: "Too many documents (max 100,000 per collection)" });
        continue;
      }

      try {
        const existing = await db.listCollections({ name: collectionName }).toArray();
        if (existing.length > 0) {
          await db.collection(collectionName).drop();
        }

        if (docs.length > 0) {
          const processedDocs = docs.map(convertBackupDoc) as Record<string, unknown>[];
          await db.collection(collectionName).insertMany(processedDocs, { ordered: false });
        }

        restoredCount++;
      } catch (err) {
        errors.push({ collection: collectionName, message: err instanceof Error ? err.message : String(err) });
      }
    }

    // Count R2 links in the restored data
    let r2MediaLinks = 0;
    const allDocsJson = JSON.stringify(data);
    const r2Matches = allDocsJson.match(/r2:\/\//g);
    r2MediaLinks = r2Matches?.length ?? 0;

    console.log(`[restore] ✓ Restored ${restoredCount} collections from upload`);
    return {
      success: true,
      message: `Restored ${restoredCount} collections (${skipped.length} skipped, ${errors.length} errors). ~${r2MediaLinks} R2 media references found in data.`,
      collections: restoredCount,
      r2MediaLinks,
      timestamp,
      skipped,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[restore] Failed:", msg);
    return { success: false, message: msg, collections: 0, r2MediaLinks: 0, timestamp, skipped: [], errors: [] };
  }
}

/**
 * Convert a backup document's special MongoDB JSON types back to native types.
 * Handles: { $oid: "..." } → ObjectId, { $date: "..." } → Date
 */
function convertBackupDoc(doc: unknown): unknown {
  if (doc === null || doc === undefined) return doc;
  if (Array.isArray(doc)) return doc.map(convertBackupDoc);
  if (typeof doc !== "object") return doc;

  const obj = doc as Record<string, unknown>;

  // MongoDB extended JSON ObjectId: { "$oid": "abc123" }
  if ("$oid" in obj && typeof obj.$oid === "string") {
    return new mongoose.Types.ObjectId(obj.$oid);
  }

  // MongoDB extended JSON Date: { "$date": "2024-..." }
  if ("$date" in obj && typeof obj.$date === "string") {
    return new Date(obj.$date);
  }

  // Recurse into nested objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertBackupDoc(value);
  }
  return result;
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
