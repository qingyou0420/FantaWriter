import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { FORBIDDEN, SCAN_START, normalizePinnedPort } = require("../lib/port.cjs") as {
  FORBIDDEN: Set<number>;
  SCAN_START: number;
  normalizePinnedPort: (raw: unknown) => number | null;
};

describe("pinned engine port", () => {
  it("never accepts InkOS CLI defaults 4567/4568", () => {
    expect(FORBIDDEN.has(4567)).toBe(true);
    expect(FORBIDDEN.has(4568)).toBe(true);
    expect(normalizePinnedPort(4567)).toBeNull();
    expect(normalizePinnedPort("4568")).toBeNull();
  });

  it("scans from the FantaWriter range, not 4567", () => {
    expect(SCAN_START).toBe(17831);
    expect(normalizePinnedPort(17831)).toBe(17831);
    expect(normalizePinnedPort("0")).toBeNull();
  });
});
