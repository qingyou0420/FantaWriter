import { describe, expect, it } from "vitest";
import {
  buildOutlineTree,
  chapterRowVisible,
  countDisplayTreeNodes,
  countTreeNodes,
  createDefaultAct,
  isDefaultAct,
  isDefaultSection,
  moveChapterRefToVolume,
  treeBranchVisible,
} from "./outline-tree";

describe("default act/section helpers", () => {
  it("treats createDefaultAct output as default", () => {
    const act = createDefaultAct("vol-1");
    expect(isDefaultAct(act, "vol-1")).toBe(true);
    expect(isDefaultSection(act.sections[0], "vol-1")).toBe(true);
  });

  it("does not hide a renamed act or section", () => {
    const act = createDefaultAct("vol-1");
    expect(isDefaultAct({ ...act, title: "中卷转折" }, "vol-1")).toBe(false);
    expect(
      isDefaultSection({ ...act.sections[0], title: "夜宴" }, "vol-1")
    ).toBe(false);
  });

  it("shows a hand-built non-default act", () => {
    expect(
      isDefaultAct({ id: "vol-1:act:custom", title: "第一幕" }, "vol-1")
    ).toBe(false);
  });
});

describe("display counts hide default groups", () => {
  it("keeps data-layer counts but omits default 幕/节 from display", () => {
    const tree = buildOutlineTree(
      [{ id: "vol-1", order: 1, title: "第一卷", summary: "" }],
      [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "",
          keyPoints: "",
          tags: [],
          volumeId: "vol-1",
        },
      ],
      "vol-1"
    );
    expect(countTreeNodes(tree)).toEqual({
      volumes: 1,
      acts: 1,
      sections: 1,
      chapters: 1,
    });
    expect(countDisplayTreeNodes(tree)).toEqual({
      volumes: 1,
      acts: 0,
      sections: 0,
      chapters: 1,
    });
  });
});

describe("tree branch visibility", () => {
  it("hides a volume with no matching chapters when filtering", () => {
    expect(
      treeBranchVisible({
        selfLabel: "第一卷",
        query: "",
        filter: "unwritten",
        visibleChapterCount: 0,
      })
    ).toBe(false);
  });

  it("keeps an empty volume when showing all and not searching", () => {
    expect(
      treeBranchVisible({
        selfLabel: "第一卷",
        query: "",
        filter: "all",
        visibleChapterCount: 0,
      })
    ).toBe(true);
  });

  it("keeps a volume whose title matches search even without chapter hits", () => {
    expect(
      treeBranchVisible({
        selfLabel: "霜桥卷",
        query: "霜桥",
        filter: "all",
        visibleChapterCount: 0,
      })
    ).toBe(true);
  });

  it("matches chapter rows by filter and search", () => {
    expect(
      chapterRowVisible({
        written: false,
        filter: "unwritten",
        label: "第3章 夜宴",
        query: "夜宴",
      })
    ).toBe(true);
    expect(
      chapterRowVisible({
        written: false,
        filter: "written",
        label: "第3章 夜宴",
        query: "",
      })
    ).toBe(false);
  });
});

describe("moveChapterRefToVolume", () => {
  it("moves a chapter ref to the target volume last section", () => {
    const tree = buildOutlineTree(
      [
        { id: "v1", order: 1, title: "一", summary: "" },
        { id: "v2", order: 2, title: "二", summary: "" },
      ],
      [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "",
          keyPoints: "",
          tags: [],
          volumeId: "v1",
        },
      ],
      "v1"
    );
    const moved = moveChapterRefToVolume(tree, "c1", "v2");
    expect(
      moved[0].acts[0].sections[0].chapters.map((c) => c.chapterId)
    ).toEqual([]);
    expect(
      moved[1].acts[0].sections[0].chapters.map((c) => c.chapterId)
    ).toEqual(["c1"]);
  });
});
