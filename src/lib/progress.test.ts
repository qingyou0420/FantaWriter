import { describe, expect, it } from "vitest";
import { chapterTargetChars } from "./progress";
import { LENGTH_RANGES } from "./types";

describe("chapterTargetChars", () => {
  it("derives min/max/target from LENGTH_RANGES", () => {
    for (const key of Object.keys(LENGTH_RANGES) as (keyof typeof LENGTH_RANGES)[]) {
      const got = chapterTargetChars(key);
      expect(got.min).toBe(LENGTH_RANGES[key].min);
      expect(got.max).toBe(LENGTH_RANGES[key].max);
      expect(got.target).toBe(
        Math.round((LENGTH_RANGES[key].min + LENGTH_RANGES[key].max) / 2)
      );
    }
  });
});
