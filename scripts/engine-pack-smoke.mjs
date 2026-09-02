/**
 * Smoke the assembled extraResources tree (dist-engine), not the workspace symlink graph.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineRoot = join(repoRoot, "dist-engine");
const entry = join(engineRoot, "dist", "api", "index.js");
const html = join(engineRoot, "dist", "index.html");

if (!existsSync(entry) || !existsSync(html)) {
  throw new Error("dist-engine is incomplete; run node scripts/assemble-engine.mjs first");
}

function canBind(port) {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

const root = mkdtempSync(join(tmpdir(), "fw-pack-smoke-"));
mkdirSync(join(root, "books"), { recursive: true });
mkdirSync(join(root, ".inkos"), { recursive: true });
writeFileSync(
  join(root, "inkos.json"),
  JSON.stringify({
    name: "pack-smoke",
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
  }),
);

let port = 17931;
while (!(await canBind(port)) || port === 4567) port += 1;

const child = spawn(process.execPath, [entry, root], {
  cwd: engineRoot,
  env: {
    ...process.env,
    INKOS_PROJECT_ROOT: root,
    INKOS_STUDIO_PORT: String(port),
    INKOS_DISABLE_VITE_BUILD: "1",
    INKOS_PACKAGED: "1",
    FW_INSTANCE_TOKEN: "pack-smoke-token",
    INKOS_DESKTOP: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (d) => {
  output += d.toString();
});
child.stderr.on("data", (d) => {
  output += d.toString();
});

const deadline = Date.now() + 45000;
let health;
try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`assembled engine exited ${child.exitCode}\n${output}`);
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
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!health?.ok) throw new Error(`assembled engine health failed\n${output}`);
  if (health.projectRoot !== root) throw new Error(`projectRoot mismatch: ${health.projectRoot}`);
  if (health.instanceToken !== "pack-smoke-token") throw new Error("instanceToken mismatch");
  await fetch(`http://127.0.0.1:${port}/api/v1/engine/shutdown`, { method: "POST" });
  console.log(`engine pack smoke ok port=${port} root=${root}`);
} finally {
  child.kill("SIGKILL");
  rmSync(root, { recursive: true, force: true });
}
