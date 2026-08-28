import { describe, expect, it } from "vitest";
import { addBlankOutlineChapter } from "./outline-edit";
import { flattenTreeChapterIds } from "./outline-tree";
import { createEmptyProject } from "./types";

describe("addBlankOutlineChapter", () => {
  it("creates the first chapter on a blank book without AI", () => {
    const empty = createEmptyProject("空");
    expect(empty.outline).toBeNull();
    const { project, chapterId } = addBlankOutlineChapter(empty);
    expect(project.outline?.chapters).toHaveLength(1);
    expect(project.outline?.chapters[0].id).toBe(chapterId);
    expect(project.outline?.chapters[0].order).toBe(1);
    expect(project.outline?.chapters[0].title).toBe("第一章");
    expect(flattenTreeChapterIds(project.outlineTree)).toEqual([chapterId]);
    expect(project.lastAuthorCanonEditAt).toBeTruthy();
  });

  it("inserts a sibling and keeps earlier ids/orders", () => {
    const first = addBlankOutlineChapter(createEmptyProject("续")).project;
    const firstId = first.outline!.chapters[0].id;
    const { project, chapterId } = addBlankOutlineChapter(first, firstId);
    expect(project.outline?.chapters.map((c) => c.order)).toEqual([1, 2]);
    expect(project.outline?.chapters[0].id).toBe(firstId);
    expect(project.outline?.chapters[1].id).toBe(chapterId);
    expect(flattenTreeChapterIds(project.outlineTree)).toEqual([
      firstId,
      chapterId,
    ]);
  });
});
