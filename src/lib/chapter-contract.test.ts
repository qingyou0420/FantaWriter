import { describe, expect, it } from "vitest";
import {
  chapterContractGate,
  formatChapterContract,
} from "./chapter-contract";
import { canMarkReviewed, emptyFinalizeProgress } from "./finalize-chapter";
import {
  defaultOpeningTab,
  findWriteNextChapter,
  listUnreviewedChapters,
  sortChaptersForDailyNav,
} from "./daily-flow";
import { createEmptyProject } from "./types";

describe("chapter contract gate", () => {
  it("blocks empty goal and requires explicit empty-forbid confirm", () => {
    const empty = chapterContractGate({
      chapter: { summary: "", keyPoints: "", forbidList: [] },
    });
    expect(empty.emptyGoal).toBe(true);
    expect(empty.canGenerate).toBe(false);

    const goalOnly = chapterContractGate({
      chapter: { summary: "交铃", keyPoints: "", forbidList: [] },
    });
    expect(goalOnly.emptyForbid).toBe(true);
    expect(goalOnly.canGenerate).toBe(false);
    expect(
      chapterContractGate({
        chapter: { summary: "交铃", keyPoints: "", forbidList: [] },
        confirmedEmptyForbid: true,
      }).canGenerate
    ).toBe(true);

    const both = chapterContractGate({
      chapter: { summary: "交铃", keyPoints: "", forbidList: ["不得黑化"] },
      globalForbid: ["主角不许死"],
    });
    expect(both.canGenerate).toBe(true);
  });

  it("formats forbid lines as 禁止写", () => {
    const text = formatChapterContract({
      chapter: {
        id: "c1",
        order: 1,
        title: "一",
        summary: "上路",
        keyPoints: "出城",
        tags: [],
        hook: "门后有人",
        forbidList: ["不得暗示血缘"],
        timePlace: "次日 · 霜桥",
      },
      globalForbid: ["主角不许黑化"],
    });
    expect(text).toContain("## 本章契约");
    expect(text).toContain("禁止写：主角不许黑化");
    expect(text).toContain("禁止写：不得暗示血缘");
    expect(text).toContain("次日 · 霜桥");
  });
});

describe("finalize four-pack", () => {
  it("cannot mark reviewed until every step is done or skipped", () => {
    expect(canMarkReviewed(emptyFinalizeProgress())).toBe(false);
    expect(
      canMarkReviewed({ summary: true, ledger: true, threads: false })
    ).toBe(false);
    expect(
      canMarkReviewed({ summary: true, ledger: true, threads: true })
    ).toBe(true);
  });
});

describe("daily flow", () => {
  it("opens serial books on chapters and new books on premise", () => {
    const empty = createEmptyProject("新");
    expect(defaultOpeningTab(null, empty)).toBe("overview");
    empty.outline = {
      premise: "p",
      endingNote: "",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "s",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    expect(defaultOpeningTab("characters", empty)).toBe("manuscript");
    expect(defaultOpeningTab("outline", empty)).toBe("outline");
  });

  it("sorts unreviewed chapters first and finds the next unwritten", () => {
    const p = createEmptyProject("日");
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
        content: "正文",
        status: "done",
        updatedAt: "",
        reviewState: "reviewed",
      },
      {
        chapterId: "c2",
        title: "二",
        content: "正文",
        status: "done",
        updatedAt: "",
        reviewState: "draft",
      },
    ];
    expect(listUnreviewedChapters(p).map((c) => c.id)).toEqual(["c2"]);
    const sorted = sortChaptersForDailyNav(p.outline!.chapters, p.chapters);
    expect(sorted[0].id).toBe("c2");
    expect(findWriteNextChapter(p, "c2")?.id).toBe("c3");
  });
});
