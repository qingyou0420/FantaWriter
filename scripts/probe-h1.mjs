/**
 * Blueprint H1: node:sqlite + FTS5 under system Node vs Electron ELECTRON_RUN_AS_NODE.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireElectronFts5 = process.argv.includes("--require-electron-fts5");

const snippet = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(":memory:");
let fts5 = false;
try {
  db.exec("CREATE VIRTUAL TABLE t USING fts5(content)");
  db.exec("INSERT INTO t(content) VALUES ('hello fts5')");
  const row = db.prepare("SELECT content FROM t WHERE t MATCH 'hello'").get();
  fts5 = Boolean(row && row.content);
} catch (e) {
  fts5 = false;
}
try { db.close(); } catch {}
process.stdout.write(JSON.stringify({ sqlite: true, fts5 }));
`;

function probeExec(execPath, env = {}) {
  const r = spawnSync(execPath, ["-e", snippet], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) {
    return {
      sqlite: false,
      fts5: false,
      error: (r.stderr || r.stdout || `exit ${r.status}`).toString().trim().slice(0, 400),
    };
  }
  try {
    return JSON.parse((r.stdout || "").trim());
  } catch {
    return { sqlite: false, fts5: false, error: (r.stdout || "").trim().slice(0, 400) };
  }
}

function findElectronCli() {
  const candidates = [
    join(repoRoot, "packages", "desktop", "node_modules", "electron", "cli.js"),
    join(repoRoot, "node_modules", "electron", "cli.js"),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

const system = probeExec(process.execPath);
console.log(`[H1] system node ${process.version} sqlite=${system.sqlite} fts5=${system.fts5}${system.error ? ` error=${system.error}` : ""}`);

const electronCli = findElectronCli();
let electron = { sqlite: false, fts5: false, error: "electron binary not installed" };
if (electronCli) {
  electron = probeExec(process.execPath, {
    ELECTRON_RUN_AS_NODE: undefined,
  });
  const r = spawnSync(process.execPath, [electronCli, "-e", snippet], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) {
    electron = {
      sqlite: false,
      fts5: false,
      error: (r.stderr || r.stdout || `exit ${r.status}`).toString().trim().slice(0, 400),
    };
  } else {
    try {
      electron = JSON.parse((r.stdout || "").trim());
    } catch {
      electron = { sqlite: false, fts5: false, error: (r.stdout || "").trim().slice(0, 400) };
    }
  }
  console.log(`[H1] electron ELECTRON_RUN_AS_NODE sqlite=${electron.sqlite} fts5=${electron.fts5}${electron.error ? ` error=${electron.error}` : ""}`);
} else {
  console.log("[H1] electron cli not found; skip Electron FTS5 probe");
}

if (requireElectronFts5 && !electron.fts5) {
  console.error("H1 required Electron FTS5, but node:sqlite FTS5 is unavailable under ELECTRON_RUN_AS_NODE.");
  process.exit(1);
}

console.log("[H1] probe complete (packaged engine uses Electron Node, not system Node)");
