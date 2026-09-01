import { describe, expect, it } from "vitest";
import {
  assertChapterApprovable,
  ApproveBlockedError,
  applyApproveOverride,
  approveChapterRecord,
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
