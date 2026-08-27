import { describe, expect, it } from "vitest";
import { buildConsistencyRows, toConsistencyReport } from "./consistency";
import { createEmptyProject } from "./types";

describe("buildConsistencyRows", () => {
  it("includes summary and does not slice to 12 chapters", () => {
    const p = createEmptyProject("三十章");
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: Array.from({ length: 30 }, (_, i) => ({
        id: `c${i + 1}`,
        order: i + 1,
        title: `第${i + 1}章`,
        summary: `大纲${i + 1}`,
        keyPoints: "",
        tags: [],
      })),
    };
    p.chapters = p.outline.chapters.map((ch, i) => ({
      chapterId: ch.id,
      title: ch.title,
      content: `正文${i + 1}`,
      status: "done" as const,
      updatedAt: "",
      summary: `AI摘要${i + 1}`,
    }));
    const rows = buildConsistencyRows(p);
    expect(rows).toHaveLength(30);
    expect(rows[0].summary).toBe("AI摘要1");
    expect(rows[29].summary).toBe("AI摘要30");
    expect(rows.every((r) => "summary" in r)).toBe(true);
  });

  it("scopes to a volume or chapters after coveredUpTo", () => {
    const p = createEmptyProject("范围");
    p.volumes = [
      { id: "v1", order: 1, title: "上", summary: "" },
      { id: "v2", order: 2, title: "下", summary: "" },
    ];
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "",
          keyPoints: "",
          tags: [],
          volumeId: "v1",
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "",
          keyPoints: "",
          tags: [],
          volumeId: "v2",
        },
        {
          id: "c3",
          order: 3,
          title: "三",
          summary: "",
          keyPoints: "",
          tags: [],
          volumeId: "v2",
        },
      ],
    };
    p.chapters = p.outline.chapters.map((ch) => ({
      chapterId: ch.id,
      title: ch.title,
      content: `正文${ch.order}`,
      status: "done" as const,
      updatedAt: "",
      summary: `摘要${ch.order}`,
    }));
    const vol = buildConsistencyRows(p, { scope: "volume", volumeId: "v2" });
    expect(vol.map((r) => r.order)).toEqual([2, 3]);
    const since = buildConsistencyRows(p, { scope: "sinceLast", coveredUpTo: 1 });
    expect(since.map((r) => r.order)).toEqual([2, 3]);
    const report = toConsistencyReport({ score: 8, summary: "ok", issues: [] }, 3);
    expect(report.coveredUpTo).toBe(3);
    const old = toConsistencyReport({ score: 7, summary: "旧" });
    expect(old.coveredUpTo).toBeUndefined();
    expect(old.score).toBe(7);
  });

  it("uses the summary branch after every chapter has a summary", () => {
    const p = createEmptyProject("补摘要");
    p.outline = {
      premise: "",
      endingNote: "",
      chapters: [
        { id: "c1", order: 1, title: "一", summary: "", keyPoints: "", tags: [] },
        { id: "c2", order: 2, title: "二", summary: "", keyPoints: "", tags: [] },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "很长的正文一".repeat(40),
        status: "done",
        updatedAt: "",
      },
      {
        chapterId: "c2",
        title: "二",
        content: "很长的正文二".repeat(40),
        status: "done",
        updatedAt: "",
      },
    ];
    const before = buildConsistencyRows(p);
    expect(before.every((r) => !r.summary.trim())).toBe(true);
    p.chapters = p.chapters.map((c, i) => ({
      ...c,
      summary: `补上的摘要${i + 1}`,
    }));
    const after = buildConsistencyRows(p);
    expect(after.every((r) => r.summary.startsWith("补上的摘要"))).toBe(true);
  });
});
