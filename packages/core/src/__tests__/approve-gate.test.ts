import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertChapterApprovable,
  ApproveBlockedError,
  applyApproveOverride,
  approveChapterRecord,
  buildReviewQueue,
  collectCriticalIssues,
} from "../pipeline/approve-gate.js";
import type { ChapterMeta } from "../models/chapter.js";

function chapter(overrides: Partial<ChapterMeta> = {}): ChapterMeta {
  return {
    number: 3,
    title: "Broken",
    status: "ready-for-review",
    wordCount: 2000,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    auditIssues: ["[critical] OOC: 主角突然换人设", "[warning] 节奏偏慢"],
    lengthWarnings: [],
    ...overrides,
  };
}

describe("G5 approve gate", () => {
  it("blocks approve when critical issues exist", () => {
    expect(collectCriticalIssues({ chapter: chapter() })).toHaveLength(1);
    expect(() => assertChapterApprovable({ chapter: chapter() })).toThrow(ApproveBlockedError);
  });

  it("allows approve after an explicit override is recorded", () => {
    const override = {
      who: "author",
      when: "2026-09-01T12:00:00.000Z",
      why: "带病定稿：人设改动是刻意的。",
    };
    expect(() => assertChapterApprovable({ chapter: chapter(), override })).not.toThrow();
    expect(applyApproveOverride(chapter(), override)).toMatchObject({
      status: "approved",
      approveOverride: override,
    });
  });

  it("allows approve when there are no critical issues", () => {
    expect(() => assertChapterApprovable({
      chapter: chapter({ auditIssues: ["[warning] 节奏偏慢"] }),
    })).not.toThrow();
  });

  it("approveChapterRecord is the shared G5 path used by HTTP and CLI", () => {
    expect(() => approveChapterRecord({ chapter: chapter() })).toThrow(ApproveBlockedError);
    expect(approveChapterRecord({
      chapter: chapter({ auditIssues: ["[warning] 节奏偏慢"] }),
      now: "2026-09-01T13:00:00.000Z",
    })).toMatchObject({
      status: "approved",
      updatedAt: "2026-09-01T13:00:00.000Z",
    });
    const override = {
      who: "cli",
      when: "2026-09-01T13:01:00.000Z",
      why: "带病定稿：人设改动是刻意的。",
    };
    expect(approveChapterRecord({ chapter: chapter(), override })).toMatchObject({
      status: "approved",
      approveOverride: override,
    });
  });
});

describe("buildReviewQueue author-facing copy", () => {
  const temps: string[] = [];
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("maps jargon categories and hides healthy-range noise", async () => {
    const bookDir = await mkdtemp(join(tmpdir(), "fw-review-copy-"));
    temps.push(bookDir);
    await mkdir(join(bookDir, "story", "runtime"), { recursive: true });
    await writeFile(join(bookDir, "story", "runtime", "chapter-0001.audit.json"), JSON.stringify({
      passed: true,
      summary: "ok",
      issues: [
        {
          severity: "warning",
          category: "hook 账需语义复核",
          description: "memo 在 advance/resolve 里声明要处理 H003，但确定性关键词检查没有找到对应落点",
          suggestion: "复核正文",
        },
        {
          severity: "warning",
          category: "paragraph-shape",
          description: "连续出现5个不足35字的短段，容易形成短句堆砌。",
          suggestion: "并段",
        },
        {
          severity: "info",
          category: "词汇疲劳: AI 标记词密度检查",
          description: "密度低于每3000字1次的阈值上限，属健康区间，仅作记录供 Polisher 参考。",
          suggestion: "",
        },
      ],
    }), "utf-8");

    const items = await buildReviewQueue({
      bookDir,
      chapters: [chapter({ number: 1, title: "开篇", auditIssues: [] })],
    });
    expect(items.map((item) => item.category)).toEqual(["伏笔是否写到", "段落太碎"]);
    expect(items.every((item) => !/Polisher|paragraph-shape|advance\/resolve|hook\s*账/.test(
      `${item.category}${item.description}${item.suggestion}`,
    ))).toBe(true);
  });
});
