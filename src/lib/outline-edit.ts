import { markAuthorCanonEdit } from "./canon-gate";
import {
  insertSiblingChapterRef,
  moveChapterRefToVolume,
  syncOutlineTree,
} from "./outline-tree";
import { addVolume } from "./volumes";
import type { NovelProject, Outline, OutlineChapter, Volume } from "./types";

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

export const REMOVE_OUTLINE_CHAPTER_CONFIRM =
  "删除该章大纲？对应正文也会丢失关联。";

/** 删章：直写 + 记作者痕迹。正文行保留（仅丢失关联），与旧面板一致。 */
export function removeOutlineChapter(
  project: NovelProject,
  chapterId: string
): NovelProject {
  if (!project.outline) return project;
  const nextChapters = project.outline.chapters
    .filter((c) => c.id !== chapterId)
    .map((c, i) => ({ ...c, order: i + 1 }));
  const fallback = project.volumes?.[0]?.id || `${project.id}:vol:1`;
  return markAuthorCanonEdit({
    ...project,
    outline: { ...project.outline, chapters: nextChapters },
    outlineTree: syncOutlineTree(
      project.outlineTree,
      project.volumes,
      nextChapters,
      fallback
    ),
    chapters: project.chapters.map((c) => {
      const ch = nextChapters.find((x) => x.id === c.chapterId);
      return ch ? { ...c, title: ch.title } : c;
    }),
  });
}

/** 就地改章字段。直写 + 记作者痕迹。换卷时挪树引用。 */
export function patchOutlineChapter(
  project: NovelProject,
  chapterId: string,
  partial: Partial<OutlineChapter>
): NovelProject {
  if (!project.outline) return project;
  const fallback = project.volumes?.[0]?.id || `${project.id}:vol:1`;
  const chapters = project.outline.chapters.map((c) =>
    c.id === chapterId ? { ...c, ...partial } : c
  );
  const prev = project.outline.chapters.find((c) => c.id === chapterId);
  let tree = project.outlineTree;
  if (
    partial.volumeId &&
    prev &&
    (prev.volumeId || fallback) !== partial.volumeId
  ) {
    tree = moveChapterRefToVolume(
      tree || syncOutlineTree(undefined, project.volumes, chapters, fallback),
      chapterId,
      partial.volumeId
    );
  }
  return markAuthorCanonEdit({
    ...project,
    outline: { ...project.outline, chapters },
    outlineTree: tree,
    chapters: project.chapters.map((c) =>
      c.chapterId === chapterId && partial.title
        ? { ...c, title: partial.title }
        : c
    ),
  });
}

export function patchOutlineVolume(
  project: NovelProject,
  volumeId: string,
  partial: Partial<Volume>
): NovelProject {
  return markAuthorCanonEdit({
    ...project,
    volumes: (project.volumes || []).map((v) =>
      v.id === volumeId ? { ...v, ...partial } : v
    ),
  });
}

export function addOutlineVolume(
  project: NovelProject
): { project: NovelProject; volumeId: string } {
  const volumes = addVolume(project);
  const added = volumes[volumes.length - 1];
  const fallback = volumes[0]?.id || `${project.id}:vol:1`;
  return {
    volumeId: added.id,
    project: markAuthorCanonEdit({
      ...project,
      volumes,
      outlineTree: syncOutlineTree(
        project.outlineTree,
        volumes,
        project.outline?.chapters,
        fallback
      ),
    }),
  };
}

const DRAFT_KEYS = [
  "title",
  "summary",
  "keyPoints",
  "hook",
  "intensityNote",
  "eroticNote",
  "tags",
  "castIds",
  "volumeId",
] as const;

type DraftKey = (typeof DRAFT_KEYS)[number];

function fieldEqual(
  a: OutlineChapter,
  b: OutlineChapter,
  key: DraftKey
): boolean {
  const av = a[key];
  const bv = b[key];
  if (Array.isArray(av) || Array.isArray(bv)) {
    return JSON.stringify(av || []) === JSON.stringify(bv || []);
  }
  return (av || "") === (bv || "");
}

/** 可比较快照：润色确认等同 id 外部写入能被详情面板察觉。 */
export function outlineChapterDraftSnapshot(ch: OutlineChapter): string {
  return JSON.stringify(
    DRAFT_KEYS.map((k) =>
      Array.isArray(ch[k]) ? ch[k] : ch[k] || ""
    )
  );
}

/**
 * 外部写入（润色确认等）与未 flush 本地编辑合并。
 * 某字段若 incoming 相对 lastSynced 已变，采用 incoming，不让旧 pending 整段盖回去。
 */
export function mergeIncomingOutlineChapter(
  incoming: OutlineChapter,
  pending: Partial<OutlineChapter>,
  lastSynced: OutlineChapter
): OutlineChapter {
  const next: OutlineChapter = { ...incoming };
  for (const key of DRAFT_KEYS) {
    if (pending[key] === undefined) continue;
    if (fieldEqual(incoming, lastSynced, key)) {
      (next as Record<DraftKey, OutlineChapter[DraftKey]>)[key] = pending[
        key
      ] as OutlineChapter[DraftKey];
    }
  }
  return next;
}

/** 外部已改写的字段从 pending 里拿掉，避免下一拍又盖回去。 */
export function retainPendingAfterIncoming(
  pending: Partial<OutlineChapter>,
  incoming: OutlineChapter,
  lastSynced: OutlineChapter
): Partial<OutlineChapter> {
  const next: Partial<OutlineChapter> = {};
  for (const key of DRAFT_KEYS) {
    if (pending[key] === undefined) continue;
    if (fieldEqual(incoming, lastSynced, key)) {
      (next as Record<string, unknown>)[key] = pending[key];
    }
  }
  return next;
}
