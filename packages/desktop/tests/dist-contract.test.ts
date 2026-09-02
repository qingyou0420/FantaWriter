import { readFileSync } from "node:fs";
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

describe("2.0.0 Windows installer contract", () => {
  it("keeps root and desktop on the same stable 2.0.0", () => {
    expect(rootPkg.version).toBe("2.0.0");
    expect(desktopPkg.version).toBe("2.0.0");
    expect(desktopPkg.license).toBe("AGPL-3.0-only");
    expect(rootPkg.scripts["dist:win"]).toBe("node scripts/dist-win.mjs");
    expect(rootPkg.scripts["dist:win"]).not.toMatch(/exit 1/);
  });

  it("names the NSIS artifact FantaWriter-Setup-2.0.0.exe", () => {
    expect(setupFileNameForVersion(rootPkg.version)).toBe("FantaWriter-Setup-2.0.0.exe");
    const yml = readFileSync(join(desktopDir, "electron-builder.yml"), "utf8");
    expect(yml).toMatch(/artifactName:\s*FantaWriter-Setup-\$\{version\}\.\$\{ext\}/);
    expect(yml).toMatch(/from:\s*\.\.\/\.\.\/dist-engine/);
    expect(yml).toMatch(/to:\s*engine/);
    expect(yml).not.toMatch(/src\/app|next\.config/);
  });
});
