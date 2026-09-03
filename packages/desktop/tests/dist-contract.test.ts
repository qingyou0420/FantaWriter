import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(here, "..");
const repoRoot = join(desktopDir, "..", "..");
const rootPkg = require(join(repoRoot, "package.json")) as { version: string; scripts: Record<string, string> };
const desktopPkg = require(join(desktopDir, "package.json")) as { version: string; license: string };
const { setupFileNameForVersion } = require("../lib/setup-artifact.cjs") as {
  setupFileNameForVersion: (version: string) => string;
};

describe("2.0.6 Windows installer contract", () => {
  it("keeps root and desktop on the same stable 2.0.6", () => {
    expect(rootPkg.version).toBe("2.0.6");
    expect(desktopPkg.version).toBe("2.0.6");
    expect(desktopPkg.license).toBe("AGPL-3.0-only");
    expect(rootPkg.scripts["dist:win"]).toBe("node scripts/dist-win.mjs");
    expect(rootPkg.scripts["dist:win"]).not.toMatch(/exit 1/);
  });

  it("names the NSIS artifact FantaWriter-Setup-2.0.6.exe", () => {
    expect(setupFileNameForVersion(rootPkg.version)).toBe("FantaWriter-Setup-2.0.6.exe");
    const yml = readFileSync(join(desktopDir, "electron-builder.yml"), "utf8");
    expect(yml).toMatch(/artifactName:\s*FantaWriter-Setup-\$\{version\}\.\$\{ext\}/);
    expect(yml).toMatch(/from:\s*\.\.\/\.\.\/dist-engine/);
    expect(yml).toMatch(/to:\s*engine/);
    expect(yml).not.toMatch(/src\/app|next\.config/);
  });

  it("ships icon.ico so the Windows installer is not the default Electron icon", () => {
    const ico = join(repoRoot, "build", "icon.ico");
    const png = join(repoRoot, "build", "icon.png");
    const mark = join(repoRoot, "build", "fantawriter-mark.png");
    const yml = readFileSync(join(desktopDir, "electron-builder.yml"), "utf8");
    expect(existsSync(ico)).toBe(true);
    expect(existsSync(png)).toBe(true);
    expect(existsSync(mark)).toBe(true);
    const header = readFileSync(ico).subarray(0, 4);
    expect(header.equals(Buffer.from([0, 0, 1, 0]))).toBe(true);
    expect(yml).toMatch(/buildResources:\s*\.\.\/\.\.\/build/);
    expect(yml).toMatch(/icon:\s*icon\.ico/);
    expect(yml).toMatch(/^\s*- icon\.png$/m);
  });

  it("brands first-run and the Electron window as 幻想作家, not InkOS", () => {
    const firstRun = readFileSync(join(desktopDir, "first-run.html"), "utf8");
    const main = readFileSync(join(desktopDir, "main.cjs"), "utf8");
    expect(firstRun).toMatch(/<h1>幻想作家<\/h1>/);
    expect(firstRun).toMatch(/src="icon\.png"/);
    expect(firstRun).toMatch(/id="serviceName"/);
    expect(firstRun).toMatch(/name: \$\("serviceName"\)\.value/);
    expect(firstRun).not.toMatch(/InkOS Studio|InkosLogo|>InkOS</);
    expect(main).toMatch(/title: "幻想作家 \/ FantaWriter"/);
    expect(main).toMatch(/icon: path\.join\(__dirname, "icon\.png"\)/);
    expect(main).not.toMatch(/title: "InkOS/);
  });
});

