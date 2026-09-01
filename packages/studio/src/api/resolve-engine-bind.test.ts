import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEnginePort, resolveEngineProjectRoot } from "./resolve-engine-bind.js";

describe("resolveEngineProjectRoot", () => {
  it("requires an explicit root and never uses cwd", () => {
    expect(() => resolveEngineProjectRoot(undefined, undefined)).toThrow(/INKOS_PROJECT_ROOT/);
    expect(() => resolveEngineProjectRoot("", "")).toThrow(/will not fall back to process.cwd/);
    expect(resolveEngineProjectRoot("/tmp/fw-root", undefined)).toBe(resolve("/tmp/fw-root"));
    expect(resolveEngineProjectRoot(undefined, "/tmp/from-env")).toBe(resolve("/tmp/from-env"));
  });
});

describe("resolveEnginePort", () => {
  it("requires an explicit port and refuses a missing 4567 default", () => {
    expect(() => resolveEnginePort(undefined)).toThrow(/4567/);
    expect(() => resolveEnginePort("")).toThrow(/INKOS_STUDIO_PORT/);
    expect(resolveEnginePort("17831")).toBe(17831);
  });
});
