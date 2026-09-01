import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  defaultProjectRoot,
  isAbsoluteRoot,
  ensureProjectLayout,
  writeSecrets,
  writeProjectLlm,
} = require("../lib/project.cjs") as {
  defaultProjectRoot: (documentsDir?: string) => string;
  isAbsoluteRoot: (root: string) => boolean;
  ensureProjectLayout: (root: string) => string;
  writeSecrets: (root: string, service: string, apiKey: string) => string;
  writeProjectLlm: (root: string, opts: { baseUrl: string; model: string }) => string;
};

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("defaultProjectRoot", () => {
  it("uses Documents/幻想作家 and never process.cwd()", () => {
    const root = defaultProjectRoot("/Users/me/Documents");
    expect(root).toBe(join("/Users/me/Documents", "幻想作家"));
    expect(root).not.toBe(process.cwd());
  });
});

describe("ensureProjectLayout", () => {
  it("refuses a relative root", () => {
    expect(() => ensureProjectLayout("relative/path")).toThrow(/absolute/);
  });

  it("creates the standard InkOS layout", () => {
    const dir = mkdtempSync(join(tmpdir(), "fw-proj-"));
    temps.push(dir);
    const root = ensureProjectLayout(dir);
    const config = JSON.parse(readFileSync(join(root, "inkos.json"), "utf8")) as {
      language: string;
    };
    expect(config.language).toBe("zh");
    writeProjectLlm(root, { baseUrl: "https://api.deepseek.com", model: "deepseek-v4-pro" });
    writeSecrets(root, "custom", "sk-test");
    const secrets = JSON.parse(readFileSync(join(root, ".inkos", "secrets.json"), "utf8")) as {
      services: { custom: { apiKey: string } };
    };
    expect(secrets.services.custom.apiKey).toBe("sk-test");
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toContain(".inkos/secrets.json");
    expect(isAbsoluteRoot(root)).toBe(true);
  });
});
