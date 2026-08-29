import { describe, expect, it } from "vitest";
import {
  addBlankOutlineChapter,
  addOutlineVolume,
  mergeIncomingOutlineChapter,
  outlineChapterDraftSnapshot,
  patchOutlineChapter,
  removeOutlineChapter,
  retainPendingAfterIncoming,
} from "./outline-edit";
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

  it("patches chapter fields and records an author edit", () => {
    const { project, chapterId } = addBlankOutlineChapter(
      createEmptyProject("改")
    );
    const next = patchOutlineChapter(project, chapterId, {
      title: "霜桥",
      summary: "离乡",
      hook: "谁在对岸",
    });
    expect(next.outline?.chapters[0].title).toBe("霜桥");
    expect(next.outline?.chapters[0].summary).toBe("离乡");
    expect(next.outline?.chapters[0].hook).toBe("谁在对岸");
    expect(next.chapters[0].title).toBe("霜桥");
    expect(next.lastAuthorCanonEditAt).toBeTruthy();
  });

  it("removes a chapter and keeps remaining orders contiguous", () => {
    const first = addBlankOutlineChapter(createEmptyProject("删")).project;
    const second = addBlankOutlineChapter(
      first,
      first.outline!.chapters[0].id
    ).project;
    const keepId = second.outline!.chapters[0].id;
    const dropId = second.outline!.chapters[1].id;
    const next = removeOutlineChapter(second, dropId);
    expect(next.outline?.chapters.map((c) => c.id)).toEqual([keepId]);
    expect(next.outline?.chapters[0].order).toBe(1);
    expect(flattenTreeChapterIds(next.outlineTree)).toEqual([keepId]);
  });

  it("adds a volume and syncs the tree", () => {
    const empty = createEmptyProject("卷");
    const { project, volumeId } = addOutlineVolume(empty);
    expect(project.volumes).toHaveLength(2);
    expect(project.volumes?.some((v) => v.id === volumeId)).toBe(true);
    expect(project.outlineTree?.some((v) => v.id === volumeId)).toBe(true);
  });
});

describe("mergeIncomingOutlineChapter", () => {
  const base = {
    id: "c3",
    order: 3,
    title: "三",
    summary: "旧摘要",
    keyPoints: "旧点",
    tags: [] as string[],
  };

  it("polish 确认 → 面板 summary 为润色后文本 → 键入一字 → 落库值为润色文本+一字", () => {
    const last = { ...base };
    const incoming = { ...base, summary: "润色后的摘要" };
    expect(outlineChapterDraftSnapshot(last)).not.toBe(
      outlineChapterDraftSnapshot(incoming)
    );
    const shown = mergeIncomingOutlineChapter(incoming, {}, last);
    expect(shown.summary).toBe("润色后的摘要");
    const afterType = mergeIncomingOutlineChapter(
      incoming,
      { summary: "润色后的摘要X" },
      incoming
    );
    expect(afterType.summary).toBe("润色后的摘要X");
  });

  it("does not let stale pending overwrite a polished field", () => {
    const last = { ...base };
    const incoming = { ...base, summary: "润色后的摘要" };
    const shown = mergeIncomingOutlineChapter(
      incoming,
      { summary: "旧摘要再打一字" },
      last
    );
    expect(shown.summary).toBe("润色后的摘要");
    expect(
      retainPendingAfterIncoming({ summary: "旧摘要再打一字" }, incoming, last)
    ).toEqual({});
  });
});
