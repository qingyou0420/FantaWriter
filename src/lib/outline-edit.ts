import { markAuthorCanonEdit } from "./canon-gate";
import { insertSiblingChapterRef, syncOutlineTree } from "./outline-tree";
import type { NovelProject, Outline, OutlineChapter } from "./types";

function emptyOutline(project: NovelProject): Outline {
  return {
    premise: project.premiseCard?.premise || project.outline?.premise || "",
    endingNote: project.outline?.endingNote || "",
    chapters: project.outline?.chapters ? [...project.outline.chapters] : [],
  };
}

function blankChapter(
  id: string,
  order: number,
  volumeId: string,
  title: string
): OutlineChapter {
  return {
    id,
    order,
    title,
    summary: "",
    keyPoints: "",
    tags: [],
    volumeId,
  };
}

/** 手工插入一章（空书第一章或同级）。作者直写，记修改痕迹。 */
export function addBlankOutlineChapter(
  project: NovelProject,
  afterId?: string | null
): { project: NovelProject; chapterId: string } {
  const fallback = project.volumes?.[0]?.id || `${project.id}:vol:1`;
  const outline = emptyOutline(project);
  const after = afterId
    ? outline.chapters.find((c) => c.id === afterId)
    : undefined;
  const id = crypto.randomUUID();
  const created = blankChapter(
    id,
    after ? after.order + 1 : outline.chapters.length + 1,
    after?.volumeId || fallback,
    after ? "新章" : "第一章"
  );
  const chapters = [...outline.chapters];
  if (after) {
    const idx = chapters.findIndex((c) => c.id === afterId);
    chapters.splice(idx < 0 ? chapters.length : idx + 1, 0, created);
  } else {
    chapters.push(created);
  }
  const renumbered = chapters.map((c, i) => ({ ...c, order: i + 1 }));
  let tree =
    project.outlineTree ||
    syncOutlineTree(undefined, project.volumes, outline.chapters, fallback);
  if (after) {
    tree = insertSiblingChapterRef(tree, after.id, id);
  } else {
    tree = syncOutlineTree(tree, project.volumes, renumbered, fallback);
  }
  const existing = project.chapters.find((c) => c.chapterId === id);
  return {
    chapterId: id,
    project: markAuthorCanonEdit({
      ...project,
      outline: { ...outline, chapters: renumbered },
      outlineTree: tree,
      chapters: existing
        ? project.chapters
        : [
            ...project.chapters,
            {
              chapterId: id,
              title: created.title,
              content: "",
              status: "idle",
              updatedAt: new Date().toISOString(),
            },
          ],
    }),
  };
}
