import { describe, expect, it } from "vitest";
import {
  findRecommendedOutlineChapter,
  findWriteNextChapter,
  resolveWriteThisChapter,
} from "./daily-flow";
import { createEmptyProject, type NovelProject } from "./types";

function bookWithFourUnwrittenFromThree(): NovelProject {
  const p = createEmptyProject("测");
  const vol = p.volumes![0].id;
  p.outline = {
    premise: "",
    endingNote: "",
    chapters: [
      {
        id: "c1",
        order: 1,
        title: "一",
        summary: "",
        keyPoints: "",
        tags: [],
        volumeId: vol,
      },
      {
        id: "c2",
        order: 2,
        title: "二",
        summary: "",
        keyPoints: "",
        tags: [],
        volumeId: vol,
      },
      {
        id: "c3",
        order: 3,
        title: "三",
        summary: "第三章摘要",
        keyPoints: "",
        tags: [],
        volumeId: vol,
      },
      {
        id: "c4",
        order: 4,
        title: "四",
        summary: "第四章摘要",
        keyPoints: "",
        tags: [],
        volumeId: vol,
      },
    ],
  };
  p.chapters = [
    {
      chapterId: "c1",
      title: "一",
      content: "已写一",
      status: "done",
      updatedAt: "",
    },
    {
      chapterId: "c2",
      title: "二",
      content: "已写二",
      status: "done",
      updatedAt: "",
    },
    {
      chapterId: "c3",
      title: "三",
      content: "",
      status: "idle",
      updatedAt: "",
    },
    {
      chapterId: "c4",
      title: "四",
      content: "",
      status: "idle",
      updatedAt: "",
    },
  ];
  return p;
}

describe("resolveWriteThisChapter", () => {
  it("点第 3 章（未写，第 4 章也未写）→ 对话框是第 3 章", () => {
    const p = bookWithFourUnwrittenFromThree();
    const picked = resolveWriteThisChapter(p, "c3");
    expect(picked?.id).toBe("c3");
    expect(picked?.order).toBe(3);
    expect(picked?.title).toBe("三");
    // 顶栏「写下一章」仍走之后第一个未写章
    expect(findWriteNextChapter(p, "c3")?.id).toBe("c4");
  });
});

describe("findRecommendedOutlineChapter", () => {
  it("returns the first unwritten chapter", () => {
    const p = bookWithFourUnwrittenFromThree();
    expect(findRecommendedOutlineChapter(p)?.id).toBe("c3");
  });

  it("returns null when every chapter is written", () => {
    const p = bookWithFourUnwrittenFromThree();
    p.chapters = p.chapters.map((c) => ({
      ...c,
      content: c.content || "写完",
    }));
    expect(findRecommendedOutlineChapter(p)).toBeNull();
  });
});
