import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  LEGACY_SETUP_PREFIX,
  setupNamesForVersion,
  hashFromSha256Sidecar,
  aliasLegacySetup,
} = require("../../scripts/alias-legacy-setup.cjs") as {
  LEGACY_SETUP_PREFIX: string;
  setupNamesForVersion: (version: string) => {
    version: string;
    primary: string;
    legacy: string;
  };
  hashFromSha256Sidecar: (text: string) => string;
  aliasLegacySetup: (opts: { distDir: string; version: string }) => {
    primary: string;
    legacy: string;
    sha256: string;
  };
};

const HASH = "a".repeat(64);
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("aliasLegacySetup", () => {
  it("names the 1.4.0-compatible copy Fantasy-Writer-Setup-<version>.exe", () => {
    expect(LEGACY_SETUP_PREFIX).toBe("Fantasy-Writer-Setup");
    expect(setupNamesForVersion("v1.4.2")).toEqual({
      version: "1.4.2",
      primary: "FantaWriter-Setup-1.4.2.exe",
      legacy: "Fantasy-Writer-Setup-1.4.2.exe",
    });
  });

  it("copies the primary installer and sha256 to the legacy names", () => {
    const distDir = mkdtempSync(join(tmpdir(), "alias-legacy-setup-"));
    dirs.push(distDir);
    const names = setupNamesForVersion("1.4.2");
    const payload = Buffer.from("nsis-installer");
    writeFileSync(join(distDir, names.primary), payload);
    writeFileSync(join(distDir, `${names.primary}.sha256`), `${HASH}  ${names.primary}\n`);

    const result = aliasLegacySetup({ distDir, version: "1.4.2" });

    expect(result.sha256).toBe(HASH);
    expect(readFileSync(join(distDir, names.legacy))).toEqual(payload);
    expect(hashFromSha256Sidecar(readFileSync(join(distDir, `${names.legacy}.sha256`), "utf8"))).toBe(
      HASH
    );
  });
});
