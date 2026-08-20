import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { SETUP_RE, versionFromSetupName, siblingSetupName } = require("../../scripts/setup-artifact.cjs") as {
  SETUP_RE: RegExp;
  versionFromSetupName: (name: string) => string | null;
  siblingSetupName: (name: string) => string | null;
};

describe("versionFromSetupName (group 1 = semver)", () => {
  it("parses H-NoveList-Setup-1.9.0.exe as 1.9.0", () => {
    const m = "H-NoveList-Setup-1.9.0.exe".match(SETUP_RE);
    expect(m?.[1]).toBe("1.9.0");
    expect(versionFromSetupName("H-NoveList-Setup-1.9.0.exe")).toBe("1.9.0");
  });

  it("parses H-NoveList-Setup-2.0.0.exe as 2.0.0", () => {
    expect(versionFromSetupName("H-NoveList-Setup-2.0.0.exe")).toBe("2.0.0");
  });

  it("parses Fantasy-Writer-Setup-2.0.0.exe as 2.0.0", () => {
    const m = "Fantasy-Writer-Setup-2.0.0.exe".match(SETUP_RE);
    expect(m?.[1]).toBe("2.0.0");
    expect(versionFromSetupName("Fantasy-Writer-Setup-2.0.0.exe")).toBe("2.0.0");
  });

  it("rejects spaced Fantasy Writer-Setup filename", () => {
    expect(versionFromSetupName("Fantasy Writer-Setup-2.0.0.exe")).toBeNull();
  });

  it("maps dual-publish sibling filenames", () => {
    expect(siblingSetupName("Fantasy-Writer-Setup-2.0.0.exe")).toBe(
      "H-NoveList-Setup-2.0.0.exe"
    );
    expect(siblingSetupName("H-NoveList-Setup-2.0.0.exe")).toBe(
      "Fantasy-Writer-Setup-2.0.0.exe"
    );
    expect(siblingSetupName("Fantasy Writer-Setup-2.0.0.exe")).toBeNull();
  });
});
