import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { FORBIDDEN, SCAN_START } = require("../lib/port.cjs") as {
  FORBIDDEN: Set<number>;
  SCAN_START: number;
};
const { resolveStudioEntry, resolveEngineRoot, studioEntryCandidates } = require("../lib/studio-entry.cjs") as {
  resolveStudioEntry: (opts?: Record<string, unknown>) => string | null;
  resolveEngineRoot: (entry: string | null) => string | null;
  studioEntryCandidates: (opts?: Record<string, unknown>) => string[];
};

const temps: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "fw-entry-"));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeEngine(root: string) {
  const api = join(root, "dist", "api");
  mkdirSync(api, { recursive: true });
  mkdirSync(join(root, "node_modules", "@actalk", "inkos-core"), { recursive: true });
  writeFileSync(join(root, "dist", "index.html"), "<html></html>");
  writeFileSync(join(api, "index.js"), "export {}\n");
  writeFileSync(join(root, "node_modules", "@actalk", "inkos-core", "package.json"), "{}");
  return join(api, "index.js");
}

describe("desktop engine port contract", () => {
  it("pins outside the InkOS CLI range", () => {
    expect(SCAN_START).toBeGreaterThan(5000);
    expect(FORBIDDEN.has(4567)).toBe(true);
  });
});

describe("packaged studio extraResources", () => {
  it("prefers resources/engine/dist/api/index.js", () => {
    const resources = tempDir();
    const entry = writeEngine(join(resources, "engine"));
    const found = resolveStudioEntry({
      isPackaged: true,
      resourcesPath: resources,
      desktopDir: tempDir(),
      workspaceRoot: tempDir(),
    });
    expect(found).toBe(entry);
    expect(resolveEngineRoot(found)).toBe(join(resources, "engine"));
  });

  it("falls back to app.asar.unpacked/engine", () => {
    const resources = tempDir();
    const entry = writeEngine(join(resources, "app.asar.unpacked", "engine"));
    const found = resolveStudioEntry({
      isPackaged: true,
      resourcesPath: resources,
      desktopDir: tempDir(),
      workspaceRoot: tempDir(),
    });
    expect(found).toBe(entry);
  });

  it("lists extraResources before the workspace tree", () => {
    const candidates = studioEntryCandidates({
      isPackaged: true,
      resourcesPath: "/pack/resources",
      desktopDir: "/repo/packages/desktop",
      workspaceRoot: "/repo",
    });
    expect(candidates[0]).toContain("/engine/dist/api/index.js");
    expect(candidates.some((c) => c.endsWith("/packages/studio/dist/api/index.js"))).toBe(true);
  });
});
