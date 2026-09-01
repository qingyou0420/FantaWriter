/**
 * Dev desktop: build InkOS core/studio if needed, then launch Electron.
 * Never starts the retired Next.js 1.x app.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(here, "..");
const repoRoot = join(desktopDir, "..", "..");
const studioEntry = join(repoRoot, "packages", "studio", "dist", "api", "index.js");
const studioIndex = join(repoRoot, "packages", "studio", "dist", "index.html");

function run(command, args, cwd = repoRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

if (!existsSync(studioEntry) || !existsSync(studioIndex)) {
  console.log("Building InkOS core + Studio (needed once for the desktop engine)…");
  await run("pnpm", ["--filter", "@actalk/inkos-core", "build"]);
  await run("pnpm", ["--filter", "@actalk/inkos-studio", "build"]);
}

const electronCli = join(repoRoot, "node_modules", "electron", "cli.js");
const localElectron = join(desktopDir, "node_modules", "electron", "cli.js");
const electronPath = existsSync(electronCli) ? electronCli : localElectron;

const child = spawn(process.execPath, [electronPath, desktopDir], {
  cwd: desktopDir,
  stdio: "inherit",
  env: { ...process.env },
});
child.on("exit", (code) => process.exit(code ?? 0));
