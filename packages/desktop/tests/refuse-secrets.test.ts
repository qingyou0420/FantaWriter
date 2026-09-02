import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { isSecretRelPath, findSecretFiles, assertNoSecrets } = require("../../../scripts/lib/refuse-secrets.cjs") as {
  isSecretRelPath: (rel: string) => boolean;
  findSecretFiles: (root: string) => string[];
  assertNoSecrets: (root: string, label?: string) => string[];
};

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("installer secret gate", () => {
  it("flags .env and secrets.json, but not .env.example", () => {
    expect(isSecretRelPath(".env")).toBe(true);
    expect(isSecretRelPath(".env.local")).toBe(true);
    expect(isSecretRelPath(".inkos/secrets.json")).toBe(true);
    expect(isSecretRelPath("secrets.json")).toBe(true);
    expect(isSecretRelPath(".env.example")).toBe(false);
    expect(isSecretRelPath("dist/api/index.js")).toBe(false);
  });

  it("walks a payload tree and throws on secrets", () => {
    const dir = mkdtempSync(join(tmpdir(), "fw-secrets-"));
    temps.push(dir);
    mkdirSync(join(dir, ".inkos"), { recursive: true });
    writeFileSync(join(dir, "ok.txt"), "ok");
    writeFileSync(join(dir, ".inkos", "secrets.json"), "{\"key\":\"nope\"}");
    expect(findSecretFiles(dir)).toContain(".inkos/secrets.json");
    expect(() => assertNoSecrets(dir, "fixture")).toThrow(/密钥文件/);
  });
});
