import { describe, expect, it } from "vitest";
import { extractStoryFrameZone, replaceStoryFrameZone } from "./story-frame-sections";

const SAMPLE = [
  "---",
  "genreLock: 古风",
  "---",
  "",
  "## 世界铁律",
  "不可飞升。",
  "",
  "## 核心冲突",
  "德与兵。",
].join("\n");

describe("story frame zones", () => {
  it("extracts a named zone", () => {
    expect(extractStoryFrameZone(SAMPLE, "world").body).toBe("不可飞升。");
    expect(extractStoryFrameZone(SAMPLE, "ending").body).toBe("");
  });

  it("replaces or appends a zone without dropping frontmatter", () => {
    const next = replaceStoryFrameZone(SAMPLE, "world", "不可飞升，不可改史。", true);
    expect(next).toMatch(/genreLock: 古风/);
    expect(extractStoryFrameZone(next, "world").body).toBe("不可飞升，不可改史。");
    const withEnding = replaceStoryFrameZone(next, "ending", "书院重开。", true);
    expect(extractStoryFrameZone(withEnding, "ending").body).toBe("书院重开。");
  });
});
