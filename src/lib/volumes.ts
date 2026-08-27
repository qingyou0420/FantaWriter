import {
  defaultVolumeId,
  type NovelProject,
  type OutlineChapter,
  type Volume,
} from "./types";

export function sortedVolumes(project: NovelProject): Volume[] {
  const vols = [...(project.volumes || [])].sort((a, b) => a.order - b.order);
  if (vols.length) return vols;
  return [
    {
      id: defaultVolumeId(project.id),
      order: 1,
      title: "第一卷",
      summary: "",
    },
  ];
}

export function chapterVolumeId(
  chapter: OutlineChapter,
  project: NovelProject
): string {
  return chapter.volumeId || sortedVolumes(project)[0].id;
}

export function chaptersInVolume(
  project: NovelProject,
  volumeId: string
): OutlineChapter[] {
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  return chapters.filter((c) => chapterVolumeId(c, project) === volumeId);
}

export function addVolume(project: NovelProject): Volume[] {
  const vols = sortedVolumes(project);
  const order = vols.reduce((m, v) => Math.max(m, v.order), 0) + 1;
  return [
    ...vols,
    {
      id: crypto.randomUUID(),
      order,
      title: `第 ${order} 卷`,
      summary: "",
    },
  ];
}

export function moveVolume(
  volumes: Volume[],
  id: string,
  dir: -1 | 1
): Volume[] {
  const sorted = [...volumes].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((v) => v.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted;
  const next = [...sorted];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  return next.map((v, idx) => ({ ...v, order: idx + 1 }));
}

export function removeVolume(
  project: NovelProject,
  volumeId: string
): { volumes: Volume[]; chapters: OutlineChapter[] } {
  const vols = sortedVolumes(project);
  if (vols.length <= 1) {
    return {
      volumes: vols,
      chapters: project.outline?.chapters || [],
    };
  }
  const nextVols = vols
    .filter((v) => v.id !== volumeId)
    .map((v, i) => ({ ...v, order: i + 1 }));
  const fallback = nextVols[0].id;
  const chapters = (project.outline?.chapters || []).map((c) =>
    chapterVolumeId(c, project) === volumeId
      ? { ...c, volumeId: fallback }
      : c
  );
  return { volumes: nextVols, chapters };
}

export function chaptersGroupedByVolume(project: NovelProject): {
  volume: Volume;
  chapters: OutlineChapter[];
}[] {
  return sortedVolumes(project).map((volume) => ({
    volume,
    chapters: chaptersInVolume(project, volume.id),
  }));
}

/** 该卷是否已有非空正文（按卷重排大纲前必须确认） */
/** 已写到最远的那一章所在卷；没有正文则取最后一章所在卷 */
export function volumeIdForLatestWrittenChapter(project: NovelProject): string {
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  const written = chapters.filter((ch) => {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return Boolean(row?.content?.trim());
  });
  const pick = written[written.length - 1] || chapters[chapters.length - 1];
  if (pick) return chapterVolumeId(pick, project);
  return sortedVolumes(project)[0]?.id || "";
}

export function volumeHasWrittenChapters(
  project: NovelProject,
  volumeId: string
): boolean {
  return chaptersInVolume(project, volumeId).some((ch) => {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return Boolean(row?.content?.trim());
  });
}

/** 前卷终局：上一卷摘要 + 该卷最后一章摘要/正文头 */
export function previousVolumeEnding(
  project: NovelProject,
  volumeId: string
): string {
  const vols = sortedVolumes(project);
  const current = vols.find((v) => v.id === volumeId);
  if (!current) return "";
  const prev = [...vols].reverse().find((v) => v.order < current.order);
  if (!prev) return "";
  const lastCh = [...chaptersInVolume(project, prev.id)].pop();
  const row = lastCh
    ? project.chapters.find((c) => c.chapterId === lastCh.id)
    : undefined;
  const snap = (prev.exitSnapshots || [])
    .filter((s) => s.name || s.note)
    .map((s) => `${s.name}：${s.note}`)
    .join("；");
  const parts = [
    prev.summary && `上卷《${prev.title}》主题：${prev.summary}`,
    snap && `出卷人物快照：${snap}`,
    prev.timelineAnchor?.trim() && `时间落点：${prev.timelineAnchor.trim()}`,
    lastCh &&
      `上卷终章《${lastCh.title}》：${row?.summary || lastCh.summary || (row?.content || "").replace(/\s+/g, " ").slice(0, 200) || "（无摘要）"}`,
  ].filter(Boolean);
  return parts.join("\n");
}

/** 把一卷新大纲挂上 volumeId，插入该卷应在的位置并重排 order */
export function mergeVolumeChapters(
  existing: OutlineChapter[],
  incoming: OutlineChapter[],
  volumeId: string,
  volumes?: Volume[]
): OutlineChapter[] {
  const kept = existing.filter((c) => (c.volumeId || "") !== volumeId);
  const stamped = incoming.map((c) => ({
    ...c,
    id: c.id || crypto.randomUUID(),
    volumeId,
    tags: Array.isArray(c.tags) ? c.tags : [],
  }));
  const volOrder = volumes?.find((v) => v.id === volumeId)?.order;
  if (volOrder != null && volumes) {
    const laterVolIds = new Set(
      volumes.filter((v) => v.order > volOrder).map((v) => v.id)
    );
    const insertAt = kept.findIndex(
      (c) => c.volumeId && laterVolIds.has(c.volumeId)
    );
    const merged =
      insertAt < 0
        ? [...kept, ...stamped]
        : [...kept.slice(0, insertAt), ...stamped, ...kept.slice(insertAt)];
    return merged.map((c, i) => ({ ...c, order: i + 1 }));
  }
  return [...kept, ...stamped].map((c, i) => ({ ...c, order: i + 1 }));
}

/** 把新章追加到该卷末尾，不替换已有章，再重排全书 order */
export function appendVolumeChapters(
  existing: OutlineChapter[],
  incoming: OutlineChapter[],
  volumeId: string,
  volumes?: Volume[]
): OutlineChapter[] {
  const current = existing.filter((c) => (c.volumeId || "") === volumeId);
  return mergeVolumeChapters(
    existing,
    [...current, ...incoming],
    volumeId,
    volumes
  );
}

/** 在指定章后插入新章，继承 volumeId，重排全书 order */
export function insertChapterAfter(
  existing: OutlineChapter[],
  afterId: string,
  incoming: OutlineChapter
): OutlineChapter[] {
  const sorted = [...existing].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((c) => c.id === afterId);
  const insertAt = idx < 0 ? sorted.length : idx + 1;
  const next = [
    ...sorted.slice(0, insertAt),
    {
      ...incoming,
      id: incoming.id || crypto.randomUUID(),
      volumeId: incoming.volumeId || sorted[idx]?.volumeId,
      tags: Array.isArray(incoming.tags) ? incoming.tags : [],
    },
    ...sorted.slice(insertAt),
  ];
  return next.map((c, i) => ({ ...c, order: i + 1 }));
}

export function volumeAllChaptersDone(
  project: NovelProject,
  volumeId: string
): boolean {
  const chs = chaptersInVolume(project, volumeId);
  if (!chs.length) return false;
  return chs.every((ch) => {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return Boolean(row?.content?.trim() && row.status === "done");
  });
}

export function volumeNeedsSummaryPrompt(
  project: NovelProject,
  volumeId: string
): boolean {
  const vol = (project.volumes || []).find((v) => v.id === volumeId);
  if (!vol || vol.summary?.trim()) return false;
  return volumeAllChaptersDone(project, volumeId);
}
