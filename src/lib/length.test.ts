import { describe, expect, it } from "vitest";
import { LENGTH_RANGES } from "./types";
import {
  chapterBelowMin,
  chapterLengthRequirement,
  continueLengthRequirement,
  countChapterChars,
  expandTargetChars,
  lengthRangeFor,
} from "./length";

describe("length ranges", () => {
  it("maps long band to 3000–5000", () => {
    expect(LENGTH_RANGES.long).toEqual({ min: 3000, max: 5000 });
    expect(lengthRangeFor("long").min).toBe(3000);
  });

  it("counts chars without whitespace", () => {
    expect(countChapterChars("你 好\n世界")).toBe(4);
  });

  it("flags text below the long-band floor", () => {
    expect(chapterBelowMin("x".repeat(2999), "long")).toBe(true);
    expect(chapterBelowMin("x".repeat(3000), "long")).toBe(false);
  });

  it("hard requirement names the numeric band", () => {
    const text = chapterLengthRequirement("long");
    expect(text).toContain("3000–5000");
    expect(text).toContain("硬性");
    expect(text).toContain("禁止");
  });

  it("continue prompt asks to fill the remaining gap", () => {
    const text = continueLengthRequirement({ length: "long" }, 1800);
    expect(text).toContain("1800");
    expect(text).toContain("3000");
    expect(text).toMatch(/至少 1200/);
  });

  it("expand 2× is at least 1.6×", () => {
    expect(expandTargetChars(1000, 2)).toBeGreaterThanOrEqual(1600);
    expect(expandTargetChars(1000, 2)).toBe(2000);
    expect(expandTargetChars(1000, Number("2"))).toBe(2000);
    expect(expandTargetChars(1000, 1.5)).toBe(1500);
  });
});
