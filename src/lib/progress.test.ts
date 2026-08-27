import { describe, expect, it } from "vitest";
import { chapterTargetChars, serialBoardStats } from "./progress";
import { LENGTH_RANGES, createEmptyProject } from "./types";

describe("chapterTargetChars", () => {
  it("derives min/max/target from LENGTH_RANGES", () => {
    for (const key of Object.keys(LENGTH_RANGES) as (keyof typeof LENGTH_RANGES)[]) {
      const got = chapterTargetChars(key);
      expect(got.min).toBe(LENGTH_RANGES[key].min);
      expect(got.max).toBe(LENGTH_RANGES[key].max);
      expect(got.target).toBe(
        Math.round((LENGTH_RANGES[key].min + LENGTH_RANGES[key].max) / 2)
      );
    }
  });
});

describe("serialBoardStats", () => {
  it("counts backlog, published, and recent words", () => {
    const p = createEmptyProject("看板");
    const now = Date.parse("2026-08-27T00:00:00.000Z");
    p.outline = {
      premise: "",
      endingNote: "",
      chapters: [
        { id: "c1", order: 1, title: "一", summary: "", keyPoints: "", tags: [] },
        { id: "c2", order: 2, title: "二", summary: "", keyPoints: "", tags: [] },
        { id: "c3", order: 3, title: "三", summary: "", keyPoints: "", tags: [] },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "甲乙丙丁戊己庚辛",
        status: "done",
        updatedAt: "2026-08-26T00:00:00.000Z",
        reviewState: "reviewed",
      },
      {
        chapterId: "c2",
        title: "二",
        content: "壬癸",
        status: "done",
        updatedAt: "2026-08-10T00:00:00.000Z",
        publishedAt: "2026-08-11T00:00:00.000Z",
      },
      {
        chapterId: "c3",
        title: "三",
        content: "",
        status: "idle",
        updatedAt: "2026-08-26T00:00:00.000Z",
      },
    ];
    const board = serialBoardStats(p, now);
    expect(board.backlog).toBe(1);
    expect(board.published).toBe(1);
    expect(board.wordsLast7Days).toBe(8);
  });
});
