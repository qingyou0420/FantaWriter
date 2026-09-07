import { describe, expect, it } from "vitest";
import {
  countUnifiedDiffLines,
  formatVolumeArriveCopy,
  hasPreviousChapterUnapprovedReason,
  isMustFixSeverity,
  mapAuditCategory,
  mapAuditSeverity,
  mapTruthFileLabel,
  platformLabel,
  stripEngineTokens,
} from "./copy-map";

describe("copy-map", () => {
  it("maps audit severity and category to Chinese", () => {
    expect(mapAuditSeverity("critical", true)).toBe("须处理");
    expect(mapAuditSeverity("warning", true)).toBe("建议");
    expect(mapAuditCategory("continuity", true)).toBe("连贯性");
    expect(mapAuditCategory("character", true)).toBe("人物");
    expect(mapAuditCategory("timeline", true)).toBe("时间线");
    expect(mapAuditCategory("world", true)).toBe("世界规则");
    expect(mapAuditCategory("style", true)).toBe("文风");
    expect(isMustFixSeverity("critical")).toBe(true);
  });

  it("strips engine tokens from author-facing strings", () => {
    expect(stripEngineTokens("G1 未过，Objective 仍在")).not.toMatch(/G1|Objective/);
    expect(stripEngineTokens("[critical] audit-failed")).not.toMatch(/critical|audit-failed/);
  });

  it("formats volume OKR without Objective/Key Results labels", () => {
    const copy = formatVolumeArriveCopy("Objective：四人在琴荒书院相识。\nKR1 = 辩堂立誓", true);
    expect(copy.arrive).toBe("四人在琴荒书院相识。");
    expect(copy.mustLand).toBe("辩堂立誓");
    expect(copy.arrive).not.toMatch(/Objective/);
  });

  it("maps platform ids to author-facing labels", () => {
    expect(platformLabel("tomato", true)).toBe("番茄小说");
    expect(platformLabel("qidian", true)).toBe("起点中文网");
    expect(platformLabel("feilu", true)).toBe("飞卢");
    expect(platformLabel("other", false)).toBe("Other");
  });

  it("maps truth file paths to author-facing labels", () => {
    expect(mapTruthFileLabel("outline/story_frame.md", true)).toBe("故事框架");
    expect(mapTruthFileLabel("story/outline/story_frame.md", true)).toBe("故事框架");
    expect(mapTruthFileLabel("roles/主要角色/苏绻.md", true)).toBe("人物 · 苏绻");
    expect(mapTruthFileLabel("roles/major/Su.md", false)).toBe("Character · Su");
    expect(countUnifiedDiffLines("@@\n+a\n+b\n-c\n--- a\n+++ b\n")).toEqual({ added: 2, removed: 1 });
  });

  it("detects 上一章未通过 as the only 带病续写 trigger", () => {
    expect(hasPreviousChapterUnapprovedReason([
      { code: "previous_chapter_not_approved", messageZh: "上一章尚未通过" },
    ])).toBe(true);
    expect(hasPreviousChapterUnapprovedReason([
      { code: "empty_story_frame", messageZh: "story_frame 为空" },
    ])).toBe(false);
  });
});
