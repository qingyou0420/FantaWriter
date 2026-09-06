import { describe, expect, it } from "vitest";
import {
  formatVolumeArriveCopy,
  hasPreviousChapterUnapprovedReason,
  isMustFixSeverity,
  mapAuditCategory,
  mapAuditSeverity,
  splitLongOutlineTitle,
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

  it("splits a long outline title into 短题 + 提要", () => {
    const split = splitLongOutlineTitle("倒叙冷开，落回书院春日苏绻入辩堂", "");
    expect(split.split).toBe(true);
    expect(split.title.length).toBeLessThanOrEqual(12);
    expect(split.summary).toContain("落回书院");
    expect(splitLongOutlineTitle("短题", "已有提要").split).toBe(false);
  });

  it("formats volume OKR without Objective/Key Results labels", () => {
    const copy = formatVolumeArriveCopy("Objective：四人在琴荒书院相识。\nKR1 = 辩堂立誓", true);
    expect(copy.arrive).toBe("四人在琴荒书院相识。");
    expect(copy.mustLand).toBe("辩堂立誓");
    expect(copy.arrive).not.toMatch(/Objective/);
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
