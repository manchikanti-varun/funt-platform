/**
 * Full dev: backend on port 38473 (never freed — avoids Windows TIME_WAIT).
 * Frontend ports 3000, 3001 are freed. Admin + LMS use NEXT_PUBLIC_API_URL=http://localhost:38473.
 */
const { execSync, spawn } = require("child_process");
const path = require("path");

const BACKEND_PORT_FULL_DEV = 38473;
const root = path.resolve(__dirname, "..");
const backendDir = path.join(root, "apps", "backend");
process.chdir(root);

function startBackend(port) {
  return spawn("npm", ["run", "dev"], {
    cwd: backendDir,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
    shell: true,
  });
}

(async () => {
  console.log("Freeing frontend ports only (3000, 3001)...");
  execSync("npm run free-ports:frontend", { stdio: "inherit" });

  console.log("Building shared packages + backend...");
  execSync(
    "npx turbo run build --filter=@funt-platform/constants --filter=@funt-platform/types --filter=@funt-platform/backend",
    { stdio: "inherit" }
  );

  console.log(`Starting backend on port ${BACKEND_PORT_FULL_DEV} (not in free-ports — no TIME_WAIT)...`);
  const backend = startBackend(BACKEND_PORT_FULL_DEV);
  backend.on("error", (err) => console.error("Backend failed to start:", err.message));

  await new Promise((r) => setTimeout(r, 3000));

  console.log("Starting admin + LMS (API → http://localhost:" + BACKEND_PORT_FULL_DEV + ")...");
  execSync(
    "npx turbo run dev --filter=@funt-platform/admin --filter=@funt-platform/lms",
    {
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT_FULL_DEV}` },
    }
  );
})();
