import type { OutlineChapter, Volume } from "./types";

export interface OutlineTreeChapterRef {
  chapterId: string;
}

export interface OutlineTreeSection {
  id: string;
  title: string;
  chapters: OutlineTreeChapterRef[];
}

export interface OutlineTreeAct {
  id: string;
  title: string;
  sections: OutlineTreeSection[];
}

export interface OutlineTreeVolume {
  id: string;
  acts: OutlineTreeAct[];
}

export type OutlineTree = OutlineTreeVolume[];

export function defaultActId(volumeId: string): string {
  return `${volumeId}:act:1`;
}

export function defaultSectionId(volumeId: string): string {
  return `${volumeId}:sec:1`;
}

export function createDefaultAct(volumeId: string): OutlineTreeAct {
  return {
    id: defaultActId(volumeId),
    title: "第一幕",
    sections: [
      {
        id: defaultSectionId(volumeId),
        title: "第一节",
        chapters: [],
      },
    ],
  };
}

function sortChapters(chapters: OutlineChapter[]): OutlineChapter[] {
  return [...chapters].sort((a, b) => a.order - b.order);
}

function sortVolumes(volumes: Volume[] | undefined): Volume[] {
  return [...(volumes || [])].sort((a, b) => a.order - b.order);
}

/** 从卷 + 章序重建树。每卷包一层默认幕/节；不改章 id / order。 */
export function buildOutlineTree(
  volumes: Volume[] | undefined,
  chapters: OutlineChapter[] | undefined,
  fallbackVolumeId: string
): OutlineTree {
  const vols = sortVolumes(volumes);
  const chs = sortChapters(chapters || []);
  const used = new Set<string>();
  const tree: OutlineTree = (vols.length
    ? vols
    : [{ id: fallbackVolumeId, order: 1, title: "第一卷", summary: "" }]
  ).map((vol) => {
    const act = createDefaultAct(vol.id);
    const mine = chs.filter((c) => (c.volumeId || fallbackVolumeId) === vol.id);
    act.sections[0].chapters = mine.map((c) => {
      used.add(c.id);
      return { chapterId: c.id };
    });
    return { id: vol.id, acts: [act] };
  });
  const orphans = chs.filter((c) => !used.has(c.id));
  if (orphans.length) {
    const first = tree[0] || {
      id: fallbackVolumeId,
      acts: [createDefaultAct(fallbackVolumeId)],
    };
    if (!tree[0]) tree.push(first);
    const sec =
      first.acts[0]?.sections[0] ||
      createDefaultAct(first.id).sections[0];
    if (!first.acts[0]) first.acts = [createDefaultAct(first.id)];
    if (!first.acts[0].sections[0]) first.acts[0].sections = [sec];
    for (const c of orphans) {
      first.acts[0].sections[0].chapters.push({ chapterId: c.id });
    }
  }
  return tree;
}

function collectChapterIds(tree: OutlineTree): Set<string> {
  const ids = new Set<string>();
  for (const vol of tree) {
    for (const act of vol.acts || []) {
      for (const sec of act.sections || []) {
        for (const ref of sec.chapters || []) {
          if (ref.chapterId) ids.add(ref.chapterId);
        }
      }
    }
  }
  return ids;
}

function lastSectionOfVolume(
  tree: OutlineTree,
  volumeId: string,
  fallbackVolumeId: string
): OutlineTreeSection {
  let node = tree.find((v) => v.id === volumeId);
  if (!node) {
    node = { id: volumeId, acts: [createDefaultAct(volumeId)] };
    tree.push(node);
  }
  if (!node.acts.length) node.acts = [createDefaultAct(volumeId)];
  const act = node.acts[node.acts.length - 1];
  if (!act.sections.length) {
    act.sections = [
      { id: defaultSectionId(volumeId), title: "第一节", chapters: [] },
    ];
  }
  return act.sections[act.sections.length - 1];
  void fallbackVolumeId;
}

/**
 * 保留已有树的幕/节分组，把新增章追加到对应卷末节，
 * 去掉已删除章，补上缺失卷。不改已有章的相对顺序。
 */
export function syncOutlineTree(
  tree: OutlineTree | undefined,
  volumes: Volume[] | undefined,
  chapters: OutlineChapter[] | undefined,
  fallbackVolumeId: string
): OutlineTree {
  const chs = sortChapters(chapters || []);
  if (!tree?.length) {
    return buildOutlineTree(volumes, chs, fallbackVolumeId);
  }
  const next: OutlineTree = tree.map((vol) => ({
    id: vol.id,
    acts: (vol.acts || []).map((act) => ({
      id: act.id || defaultActId(vol.id),
      title: act.title || "第一幕",
      sections: (act.sections || []).map((sec) => ({
        id: sec.id || defaultSectionId(vol.id),
        title: sec.title || "第一节",
        chapters: (sec.chapters || []).filter((ref) =>
          chs.some((c) => c.id === ref.chapterId)
        ),
      })),
    })),
  }));
  const known = collectChapterIds(next);
  for (const vol of sortVolumes(volumes)) {
    if (!next.some((v) => v.id === vol.id)) {
      next.push({ id: vol.id, acts: [createDefaultAct(vol.id)] });
    }
  }
  for (const ch of chs) {
    if (known.has(ch.id)) continue;
    const volId = ch.volumeId || fallbackVolumeId;
    const sec = lastSectionOfVolume(next, volId, fallbackVolumeId);
    sec.chapters.push({ chapterId: ch.id });
    known.add(ch.id);
  }
  return next;
}

export function normalizeOutlineTree(
  raw: OutlineTree | undefined,
  volumes: Volume[] | undefined,
  chapters: OutlineChapter[] | undefined,
  fallbackVolumeId: string
): OutlineTree {
  return syncOutlineTree(raw, volumes, chapters, fallbackVolumeId);
}

export function flattenTreeChapterIds(tree: OutlineTree | undefined): string[] {
  const ids: string[] = [];
  for (const vol of tree || []) {
    for (const act of vol.acts || []) {
      for (const sec of act.sections || []) {
        for (const ref of sec.chapters || []) {
          if (ref.chapterId) ids.push(ref.chapterId);
        }
      }
    }
  }
  return ids;
}

export function countTreeNodes(tree: OutlineTree | undefined): {
  volumes: number;
  acts: number;
  sections: number;
  chapters: number;
} {
  let acts = 0;
  let sections = 0;
  let chapters = 0;
  for (const vol of tree || []) {
    for (const act of vol.acts || []) {
      acts += 1;
      for (const sec of act.sections || []) {
        sections += 1;
        chapters += sec.chapters?.length || 0;
      }
    }
  }
  return { volumes: tree?.length || 0, acts, sections, chapters };
}

export function insertSiblingChapterRef(
  tree: OutlineTree,
  afterChapterId: string,
  newChapterId: string
): OutlineTree {
  return tree.map((vol) => ({
    ...vol,
    acts: vol.acts.map((act) => ({
      ...act,
      sections: act.sections.map((sec) => {
        const idx = sec.chapters.findIndex((c) => c.chapterId === afterChapterId);
        if (idx < 0) return sec;
        const chapters = [...sec.chapters];
        chapters.splice(idx + 1, 0, { chapterId: newChapterId });
        return { ...sec, chapters };
      }),
    })),
  }));
}

export type OutlineTreeFilter = "all" | "unwritten" | "written";

export function chapterMatchesTreeFilter(
  written: boolean,
  filter: OutlineTreeFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "written") return written;
  return !written;
}

export function searchTreeLabel(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

/** 默认「第一幕」：createDefaultAct 生成且标题未被作者改过。 */
export function isDefaultAct(
  act: Pick<OutlineTreeAct, "id" | "title">,
  volumeId: string
): boolean {
  return act.id === defaultActId(volumeId) && (act.title || "第一幕") === "第一幕";
}

/** 默认「第一节」：createDefaultAct 生成且标题未被作者改过。 */
export function isDefaultSection(
  section: Pick<OutlineTreeSection, "id" | "title">,
  volumeId: string
): boolean {
  return (
    section.id === defaultSectionId(volumeId) &&
    (section.title || "第一节") === "第一节"
  );
}

/** 统计行用：默认幕/节不计入显示。不改 countTreeNodes（数据层仍含默认组）。 */
export function countDisplayTreeNodes(tree: OutlineTree | undefined): {
  volumes: number;
  acts: number;
  sections: number;
  chapters: number;
} {
  let acts = 0;
  let sections = 0;
  let chapters = 0;
  for (const vol of tree || []) {
    for (const act of vol.acts || []) {
      if (!isDefaultAct(act, vol.id)) acts += 1;
      for (const sec of act.sections || []) {
        if (!isDefaultSection(sec, vol.id)) sections += 1;
        chapters += sec.chapters?.length || 0;
      }
    }
  }
  return { volumes: tree?.length || 0, acts, sections, chapters };
}

export function chapterRowVisible(opts: {
  written: boolean;
  filter: OutlineTreeFilter;
  label: string;
  query: string;
}): boolean {
  return (
    chapterMatchesTreeFilter(opts.written, opts.filter) &&
    searchTreeLabel(opts.label, opts.query)
  );
}

/** 整枝可见：自己标签命中，或任一后代可见。筛选非「全部」时，空枝（无可见章）隐藏。 */
export function treeBranchVisible(opts: {
  selfLabel: string;
  query: string;
  filter: OutlineTreeFilter;
  visibleChapterCount: number;
}): boolean {
  if (opts.visibleChapterCount > 0) return true;
  if (opts.filter !== "all") return false;
  if (opts.query.trim()) return searchTreeLabel(opts.selfLabel, opts.query);
  return true;
}

/** 把已有章引用挪到目标卷末节。不改 syncOutlineTree。 */
export function moveChapterRefToVolume(
  tree: OutlineTree,
  chapterId: string,
  volumeId: string
): OutlineTree {
  const stripped = tree.map((vol) => ({
    ...vol,
    acts: vol.acts.map((act) => ({
      ...act,
      sections: act.sections.map((sec) => ({
        ...sec,
        chapters: sec.chapters.filter((ref) => ref.chapterId !== chapterId),
      })),
    })),
  }));
  return stripped.map((vol) => {
    if (vol.id !== volumeId) return vol;
    if (!vol.acts.length) {
      return {
        ...vol,
        acts: [
          {
            ...createDefaultAct(volumeId),
            sections: [
              {
                id: defaultSectionId(volumeId),
                title: "第一节",
                chapters: [{ chapterId }],
              },
            ],
          },
        ],
      };
    }
    const lastActIdx = vol.acts.length - 1;
    const lastAct = vol.acts[lastActIdx];
    const lastSecIdx = Math.max(0, lastAct.sections.length - 1);
    const lastSec =
      lastAct.sections[lastSecIdx] || {
        id: defaultSectionId(volumeId),
        title: "第一节",
        chapters: [],
      };
    const sections = [...lastAct.sections];
    if (!sections.length) sections.push(lastSec);
    sections[sections.length - 1] = {
      ...sections[sections.length - 1],
      chapters: [
        ...sections[sections.length - 1].chapters,
        { chapterId },
      ],
    };
    const acts = [...vol.acts];
    acts[lastActIdx] = { ...lastAct, sections };
    return { ...vol, acts };
  });
}
