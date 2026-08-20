/**
 * 并行启动 next dev + electron
 */
import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";

function waitFor(url, timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error("next dev 启动超时"));
            return;
          }
          setTimeout(tick, 500);
        });
    };
    tick();
  });
}

const nextBin = path.join(
  root,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);
const electronBin = path.join(
  root,
  "node_modules",
  "electron",
  "cli.js"
);

const nextProc = spawn(process.execPath, [nextBin, "dev", "-p", "3000"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
  shell: isWin,
});

try {
  await waitFor("http://127.0.0.1:3000");
} catch (e) {
  nextProc.kill();
  console.error(e);
  process.exit(1);
}

const electronProc = spawn(
  process.execPath,
  [electronBin, path.join(root, "electron", "main.cjs")],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_START_URL: "http://127.0.0.1:3000",
    },
    shell: isWin,
  }
);

function shutdown() {
  try {
    electronProc.kill();
  } catch {}
  try {
    nextProc.kill();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
electronProc.on("exit", shutdown);
