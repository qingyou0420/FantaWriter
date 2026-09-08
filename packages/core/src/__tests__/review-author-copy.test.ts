import { describe, expect, it } from "vitest";
import {
  humanizeReviewText,
  isHealthyReviewNoise,
  mapReviewCategory,
  reviewCopyHasAuthorJargon,
  toAuthorFacingReviewIssue,
} from "../utils/review-author-copy.js";
import { overdueHookAuditIssues } from "../utils/hook-overdue.js";
import { validateHookLedger } from "../utils/hook-ledger-validator.js";

const AUTHOR_JARGON = /Polisher|paragraph-shape|advance\/resolve|hook\s*账/;

describe("review author copy", () => {
  it("maps engineer categories to novelist labels", () => {
    expect(mapReviewCategory("hook 账需语义复核", "zh")).toBe("伏笔是否写到");
    expect(mapReviewCategory("paragraph-shape", "zh")).toBe("段落太碎");
    expect(mapReviewCategory("hook-debt", "zh")).toBe("伏笔逾期");
    expect(mapReviewCategory("length-budget", "zh")).toBe("章节字数");
    expect(mapReviewCategory("title-dedup", "zh")).toBe("章节标题");
    expect(mapReviewCategory("词汇疲劳: AI 标记词密度检查", "zh")).toBe("用词习惯");
    expect(mapReviewCategory("文风检查", "zh")).toBe("文风");
    expect(mapReviewCategory("continuity", "zh")).toBe("连贯性");
    expect(mapReviewCategory("paragraph-shape", "en")).toBe("Choppy paragraphs");
    expect(mapReviewCategory("state-validation", "zh")).toBe("前后文对不上");
  });

  it("never surfaces English snake-case as a yellow-card title", () => {
    expect(mapReviewCategory("paragraph-shape", "zh")).not.toMatch(/-/);
    expect(mapReviewCategory("some-internal-rule", "zh")).toBe("审稿");
    expect(mapReviewCategory("some-internal-rule", "en")).toBe("Review");
  });

  it("rewrites leftover engineer-speak in bodies", () => {
    const text = humanizeReviewText(
      "memo 在 advance/resolve 里声明要处理 H003，但确定性关键词检查没有找到对应落点。交由 Polisher 处理，不计入结构评分。",
      "zh",
    );
    expect(text).toContain("本章计划");
    expect(text).toContain("本章要推进或收束的伏笔");
    expect(text).toContain("交给后边润色时再改");
    expect(text).not.toMatch(AUTHOR_JARGON);
    expect(reviewCopyHasAuthorJargon(text)).toBe(false);
  });

  it("hides healthy-range info notes that look like errors", () => {
    expect(isHealthyReviewNoise({
      severity: "info",
      description: "全文约4500字，‘仿佛’出现2次，密度低于每3000字1次的阈值上限，属健康区间，仅作记录供 Polisher 参考。",
    })).toBe(true);
    expect(isHealthyReviewNoise({
      severity: "info",
      description: "这是段落形状/排版问题，交由 Polisher 处理，不计入结构评分。",
    })).toBe(false);
    expect(isHealthyReviewNoise({
      severity: "warning",
      description: "连续出现5个不足35字的短段，容易形成短句堆砌。",
    })).toBe(false);
    expect(toAuthorFacingReviewIssue({
      severity: "info",
      category: "词汇疲劳: AI 标记词密度检查",
      description: "密度低于每3000字1次的阈值上限，属健康区间，仅作记录供 Polisher 参考。",
    })).toBeNull();
  });

  it("humanizes hook-ledger and overdue issues without jargon", () => {
    const memo = `## 本章 hook 账
advance:
- H003 "杂役腰牌" → planted
`;
    const violations = validateHookLedger(memo, "正文里完全没写到这块。");
    expect(violations).toHaveLength(1);
    const facing = toAuthorFacingReviewIssue(violations[0]!);
    expect(facing).not.toBeNull();
    expect(facing!.category).toBe("伏笔是否写到");
    expect(facing!.description).toContain("杂役腰牌");
    expect(`${facing!.category}${facing!.description}${facing!.suggestion}`).not.toMatch(AUTHOR_JARGON);

    const overdue = overdueHookAuditIssues([
      { hookId: "H01", startChapter: 1, status: "open", targetChapter: 3, notes: "「腰牌下落」" },
    ], 5);
    expect(overdue[0]!.description).toContain("腰牌下落");
    expect(overdue[0]!.description).not.toMatch(/Hook H01|advance, resolve/);
    expect(toAuthorFacingReviewIssue(overdue[0]!)!.category).toBe("伏笔逾期");
  });
});
