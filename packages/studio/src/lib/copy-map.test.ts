import { describe, expect, it } from "vitest";
import {
  countUnifiedDiffLines,
  formatReviewIssueCopy,
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
    expect(mapAuditCategory("paragraph-shape", true)).toBe("段落太碎");
    expect(mapAuditCategory("hook 账需语义复核", true)).toBe("伏笔是否写到");
    expect(mapAuditCategory("词汇疲劳: AI 标记词密度检查", true)).toBe("用词习惯");
    expect(isMustFixSeverity("critical")).toBe(true);
  });

  it("formats 等你过目 cards without internal jargon", () => {
    const jargon = /Polisher|paragraph-shape|advance\/resolve|hook\s*账/;
    const hook = formatReviewIssueCopy({
      severity: "warning",
      category: "hook 账需语义复核",
      description: "memo 在 advance/resolve 里声明要处理 H003，但确定性关键词检查没有找到对应落点",
    }, true);
    expect(hook?.severity).toBe("建议");
    expect(hook?.category).toBe("伏笔是否写到");
    expect(`${hook?.category}${hook?.description}`).not.toMatch(jargon);

    const shape = formatReviewIssueCopy({
      severity: "warning",
      category: "paragraph-shape",
      description: "连续出现5个不足35字的短段，容易形成短句堆砌。",
    }, true);
    expect(shape?.category).toBe("段落太碎");
    expect(shape?.description).toContain("短段");

    const polish = formatReviewIssueCopy({
      severity: "info",
      category: "文风检查",
      description: "这是段落形状/排版问题，交由 Polisher 处理，不计入结构评分。",
    }, true);
    expect(polish?.category).toBe("文风");
    expect(polish?.description).not.toMatch(jargon);

    expect(formatReviewIssueCopy({
      severity: "info",
      category: "词汇疲劳: AI 标记词密度检查",
      description: "密度低于每3000字1次的阈值上限，属健康区间，仅作记录供 Polisher 参考。",
    }, true)).toBeNull();

    const screenshotLines = [
      formatReviewIssueCopy({
        severity: "warning",
        category: "hook 账需语义复核",
        description: "memo 在 advance/resolve 里声明要处理 H003，但确定性关键词检查没有找到对应落点",
      }, true),
      formatReviewIssueCopy({
        severity: "warning",
        category: "paragraph-shape",
        description: "连续出现5个不足35字的短段，容易形成短句堆砌。",
      }, true),
      polish,
    ];
    for (const line of screenshotLines) {
      expect(line).not.toBeNull();
      expect(`${line!.category}${line!.description}`).not.toMatch(jargon);
    }
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
