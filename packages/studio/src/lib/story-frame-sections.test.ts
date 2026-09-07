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

  it("maps architect headings so world is 世界观底色, not 主题与基调", () => {
    const architect = [
      "## 主题与基调",
      "权谋与群像。",
      "",
      "## 核心冲突、对手定性、前台/后台双层故事",
      "德与兵。",
      "",
      "## 世界观底色（铁律 + 质感 + 本书专属规则）",
      "不可飞升。",
      "",
      "## 终局方向 + 全书 Objective",
      "书院重开。",
    ].join("\n");
    expect(extractStoryFrameZone(architect, "theme").body).toBe("权谋与群像。");
    expect(extractStoryFrameZone(architect, "world").body).toBe("不可飞升。");
    expect(extractStoryFrameZone(architect, "conflict").body).toBe("德与兵。");
    expect(extractStoryFrameZone(architect, "ending").body).toBe("书院重开。");
    const next = replaceStoryFrameZone(architect, "world", "不可改史。", true);
    expect(extractStoryFrameZone(next, "theme").body).toBe("权谋与群像。");
    expect(extractStoryFrameZone(next, "world").body).toBe("不可改史。");
  });

  it("replaces or appends a zone without dropping frontmatter", () => {
    const next = replaceStoryFrameZone(SAMPLE, "world", "不可飞升，不可改史。", true);
    expect(next).toMatch(/genreLock: 古风/);
    expect(extractStoryFrameZone(next, "world").body).toBe("不可飞升，不可改史。");
    const withEnding = replaceStoryFrameZone(next, "ending", "书院重开。", true);
    expect(extractStoryFrameZone(withEnding, "ending").body).toBe("书院重开。");
  });
});
