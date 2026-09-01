import { afterEach, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { findProjectRoot } from "../utils.js";

const originalRoot = process.env.INKOS_PROJECT_ROOT;
const originalDesktop = process.env.INKOS_DESKTOP;
const originalRequire = process.env.FW_REQUIRE_EXPLICIT_ROOT;

afterEach(() => {
  if (originalRoot === undefined) delete process.env.INKOS_PROJECT_ROOT;
  else process.env.INKOS_PROJECT_ROOT = originalRoot;
  if (originalDesktop === undefined) delete process.env.INKOS_DESKTOP;
  else process.env.INKOS_DESKTOP = originalDesktop;
  if (originalRequire === undefined) delete process.env.FW_REQUIRE_EXPLICIT_ROOT;
  else process.env.FW_REQUIRE_EXPLICIT_ROOT = originalRequire;
});

describe("findProjectRoot", () => {
  it("uses INKOS_PROJECT_ROOT when set", () => {
    process.env.INKOS_PROJECT_ROOT = "/tmp/fw-root";
    expect(findProjectRoot()).toBe(resolve("/tmp/fw-root"));
  });

  it("refuses cwd in desktop mode without an explicit root", () => {
    delete process.env.INKOS_PROJECT_ROOT;
    process.env.INKOS_DESKTOP = "1";
    expect(() => findProjectRoot()).toThrow(/INKOS_PROJECT_ROOT/);
  });
});
