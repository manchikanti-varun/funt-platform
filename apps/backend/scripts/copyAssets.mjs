import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "assets");
const dest = path.join(root, "dist", "assets");

if (!existsSync(src)) {
  console.warn("copyAssets: no assets folder at", src);
  process.exit(0);
}

const logo = path.join(src, "funt-logo.png");
if (!existsSync(logo)) {
  console.warn("copyAssets: funt-logo.png missing — invoice PDFs will render without a logo");
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied assets to dist/assets");
