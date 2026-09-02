/**
 * H3: flatten the pnpm workspace Studio+core graph into dist-engine/
 * so electron-builder extraResources can copy a self-contained Node tree.
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { assertNoSecrets } = require("./lib/refuse-secrets.cjs");

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(repoRoot, "dist-engine");

function run(command, args, cwd = repoRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

function mustExist(rel, label = rel) {
  const abs = join(dest, rel);
  if (!existsSync(abs)) {
    throw new Error(`assemble-engine: 缺少 ${label} (${abs})`);
  }
  return abs;
}

const studioEntry = join(repoRoot, "packages", "studio", "dist", "api", "index.js");
const studioHtml = join(repoRoot, "packages", "studio", "dist", "index.html");
const coreEntry = join(repoRoot, "packages", "core", "dist", "index.js");
if (!existsSync(studioEntry) || !existsSync(studioHtml) || !existsSync(coreEntry)) {
  console.log("[assemble-engine] building @actalk/inkos-core + @actalk/inkos-studio");
  await run("pnpm", ["--filter", "@actalk/inkos-core", "build"]);
  await run("pnpm", ["--filter", "@actalk/inkos-studio", "build"]);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

console.log("[assemble-engine] pnpm deploy @actalk/inkos-studio → dist-engine");
await run("pnpm", ["--filter", "@actalk/inkos-studio", "deploy", "--prod", "--legacy", dest]);

mustExist("dist/api/index.js", "packages/studio/dist/api/index.js");
mustExist("dist/index.html", "packages/studio/dist/index.html");
mustExist("node_modules/@actalk/inkos-core/dist/index.js", "core build");
mustExist("node_modules/@actalk/inkos-core/package.json", "core package.json");

const coreRoot = join(dest, "node_modules", "@actalk", "inkos-core");
for (const extra of ["genres", "skills", "craft"]) {
  const p = join(coreRoot, extra);
  if (!existsSync(p)) {
    throw new Error(`assemble-engine: core 缺少 ${extra}/（import.meta.url 资源）`);
  }
}

for (const dep of ["hono", "@hono/node-server"]) {
  const pkg = join(dest, "node_modules", ...dep.split("/"), "package.json");
  if (!existsSync(pkg)) {
    throw new Error(`assemble-engine: 缺少运行时依赖 ${dep}`);
  }
}

assertNoSecrets(dest, "dist-engine");
await run(process.execPath, [join(repoRoot, "scripts", "engine-pack-smoke.mjs")]);
console.log(`[assemble-engine] ok ${dest}`);
console.log("[assemble-engine] studio dist + core build + flattened node_modules ready for extraResources");
