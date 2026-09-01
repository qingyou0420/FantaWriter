import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { FORBIDDEN, SCAN_START } = require("../lib/port.cjs") as {
  FORBIDDEN: Set<number>;
  SCAN_START: number;
};

describe("desktop engine port contract", () => {
  it("pins outside the InkOS CLI range", () => {
    expect(SCAN_START).toBeGreaterThan(5000);
    expect(FORBIDDEN.has(4567)).toBe(true);
  });
});
