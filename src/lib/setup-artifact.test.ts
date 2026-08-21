import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { SETUP_RE, versionFromSetupName } = require("../../scripts/setup-artifact.cjs") as {
  SETUP_RE: RegExp;
  versionFromSetupName: (name: string) => string | null;
};

describe("versionFromSetupName (group 1 = semver)", () => {
  it("parses Fantasy-Writer-Setup-1.0.0.exe as 1.0.0", () => {
    const m = "Fantasy-Writer-Setup-1.0.0.exe".match(SETUP_RE);
    expect(m?.[1]).toBe("1.0.0");
    expect(versionFromSetupName("Fantasy-Writer-Setup-1.0.0.exe")).toBe("1.0.0");
  });

  it("parses Fantasy-Writer-Setup-2.0.0.exe as 2.0.0", () => {
    expect(versionFromSetupName("Fantasy-Writer-Setup-2.0.0.exe")).toBe("2.0.0");
  });

  it("rejects spaced Fantasy Writer-Setup filename", () => {
    expect(versionFromSetupName("Fantasy Writer-Setup-2.0.0.exe")).toBeNull();
  });

  it("rejects unrelated installer names", () => {
    expect(versionFromSetupName("Other-Setup-1.0.0.exe")).toBeNull();
  });
});
