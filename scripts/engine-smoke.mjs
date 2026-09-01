/**
 * Headless smoke: start the Studio engine with an explicit root and a pinned
 * non-4567 port, then shut it down. No Next.js 1.x path.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const entryJs = join(repoRoot, "packages", "studio", "dist", "api", "index.js");
const entryTs = join(repoRoot, "packages", "studio", "src", "api", "index.ts");

function canBind(port) {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  for (let port = 17891; port < 17930; port++) {
    if (port === 4567 || port === 4568) continue;
    if (await canBind(port)) return port;
  }
  throw new Error("no free port");
}

const root = mkdtempSync(join(tmpdir(), "fw-smoke-"));
mkdirSync(join(root, "books"), { recursive: true });
mkdirSync(join(root, ".inkos"), { recursive: true });
writeFileSync(
  join(root, "inkos.json"),
  JSON.stringify({
    name: "smoke",
    version: "0.1.0",
    language: "zh",
    llm: {
      provider: "openai",
      service: "custom",
      configSource: "studio",
      baseUrl: "https://example.invalid",
      model: "smoke",
      apiFormat: "chat",
      stream: true,
    },
  }, null, 2),
);

const port = await pickPort();
const token = "smoke-token";
const args = existsSync(entryJs)
  ? [entryJs, root]
  : ["--import", "tsx", entryTs, root];

const child = spawn(process.execPath, args, {
  env: {
    ...process.env,
    INKOS_PROJECT_ROOT: root,
    INKOS_STUDIO_PORT: String(port),
    INKOS_DISABLE_VITE_BUILD: existsSync(join(repoRoot, "packages", "studio", "dist", "index.html")) ? "1" : "0",
    FW_INSTANCE_TOKEN: token,
    INKOS_DESKTOP: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (d) => { output += d.toString(); });
child.stderr.on("data", (d) => { output += d.toString(); });

const deadline = Date.now() + 60000;
let health;
try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`engine exited ${child.exitCode}\n${output}`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (res.ok) {
        health = await res.json();
        break;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!health?.ok) throw new Error(`health failed\n${output}`);
  if (health.projectRoot !== root) throw new Error(`projectRoot mismatch: ${health.projectRoot}`);
  if (health.instanceToken !== token) throw new Error("instanceToken mismatch");
  if (port === 4567) throw new Error("smoke used 4567");
  await fetch(`http://127.0.0.1:${port}/api/v1/engine/shutdown`, { method: "POST" });
  console.log(`engine smoke ok port=${port} root=${root}`);
} finally {
  child.kill("SIGKILL");
  rmSync(root, { recursive: true, force: true });
}
