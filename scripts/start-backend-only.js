const { execSync, spawn } = require("child_process");
const path = require("path");

const BACKEND_PORT = 38472;
const root = path.resolve(__dirname, "..");
const backendDir = path.join(root, "apps", "backend");
process.chdir(root);

function isPortInUse(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} "`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

async function waitForPortFree(port, maxMs = 120000, intervalMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (!isPortInUse(port)) return true;
    console.log(`Port ${port} still in use. Waiting ${intervalMs / 1000}s...`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

(async () => {
  console.log("Freeing ports...");
  execSync("npm run free-ports", { stdio: "inherit" });

  console.log(`Waiting for port ${BACKEND_PORT} to be free...`);
  const free = await waitForPortFree(BACKEND_PORT);
  if (!free) {
    console.error(`Port ${BACKEND_PORT} still in use after 2 min. Run: npm run free-ports`);
    process.exit(1);
  }
  console.log("Waiting 45s for Windows to release the port (TIME_WAIT)...");
  await new Promise((r) => setTimeout(r, 45000));

  console.log("Starting backend...");
  spawn("npm", ["run", "dev"], {
    cwd: backendDir,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
})();
