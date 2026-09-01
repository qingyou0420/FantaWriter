/**
 * FantaWriter 2.0 P0 (2026-09-01): require explicit project root + port.
 * Upstream InkOS defaulted to cwd and 4567.
 */
import { startStudioServer } from "./server.js";
import { resolveEnginePort, resolveEngineProjectRoot } from "./resolve-engine-bind.js";
import { resolve, join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let root: string;
let port: number;
try {
  root = resolveEngineProjectRoot(process.argv[2], process.env.INKOS_PROJECT_ROOT);
  port = resolveEnginePort(process.env.INKOS_STUDIO_PORT);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const studioRoot = resolve(__dirname, "../..");
const distDir = join(studioRoot, "dist");
const packaged = process.env.INKOS_PACKAGED === "1" || process.env.INKOS_DISABLE_VITE_BUILD === "1";

if (!existsSync(join(distDir, "index.html"))) {
  if (packaged) {
    console.error("Studio frontend dist/ is missing. Packaged/desktop engines cannot run vite build.");
    process.exit(1);
  }
  console.log("Building frontend...");
  try {
    execSync("npx vite build", { cwd: studioRoot, stdio: "inherit" });
  } catch {
    console.error("Failed to build frontend. Run 'cd packages/studio && pnpm build' manually.");
    process.exit(1);
  }
}

startStudioServer(root, port, { staticDir: distDir, hostname: "127.0.0.1" }).catch((e) => {
  console.error("Failed to start studio:", e);
  process.exit(1);
});
