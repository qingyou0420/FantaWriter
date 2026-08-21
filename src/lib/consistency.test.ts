import { describe, expect, it } from "vitest";
import { buildConsistencyRows } from "./consistency";
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
});
