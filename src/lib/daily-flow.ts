import {
  chapterOrderById,
  isPlotThreadOverdue,
  maxWrittenOrder,
} from "./memory-pack";
import type {
  AccountRepairMark,
  ChapterContent,
  NovelProject,
  OutlineChapter,
  PlotThread,
} from "./types";
import { isProjectTab, type ProjectTab } from "./project-tabs";

export function listUnreviewedChapters(
  project: Pick<NovelProject, "outline" | "chapters">
): OutlineChapter[] {
  const chapters = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  return chapters.filter((ch) => {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return Boolean(row?.content?.trim()) && row?.reviewState !== "reviewed";
  });
}

export function listOverdueThreads(
  project: Pick<NovelProject, "outline" | "chapters" | "plotThreads">
): PlotThread[] {
  const orderById = chapterOrderById(project.outline?.chapters);
  const writtenMax = maxWrittenOrder(project);
  return (project.plotThreads || []).filter((t) =>
    isPlotThreadOverdue(t, orderById, writtenMax)
  );
}

export function listOpenThreadsWithoutDestination(
  threads?: PlotThread[] | null
): PlotThread[] {
  return (threads || []).filter(
    (t) => t.status !== "resolved" && !String(t.dueVolumeId || "").trim()
  );
}

export function remainingUnwrittenInVolume(
  project: Pick<NovelProject, "outline" | "chapters" | "volumes">,
  volumeId: string
): number {
  const fallback = project.volumes?.[0]?.id;
  return (project.outline?.chapters || []).filter((ch) => {
    const vol = ch.volumeId || fallback;
    if (vol !== volumeId) return false;
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return !row?.content?.trim();
  }).length;
}

export function volumeNearEnd(
  project: Pick<NovelProject, "outline" | "chapters" | "volumes">,
  volumeId: string,
  threshold = 3
): boolean {
  const inVol = (project.outline?.chapters || []).filter(
    (ch) => (ch.volumeId || project.volumes?.[0]?.id) === volumeId
  );
  if (!inVol.length) return false;
  const left = remainingUnwrittenInVolume(project, volumeId);
  return left > 0 && left <= threshold;
}

export function reviewedSinceLastCheck(
  project: Pick<NovelProject, "outline" | "chapters" | "lastConsistencyReport">
): number {
  const covered = project.lastConsistencyReport?.coveredUpTo ?? 0;
  return (project.outline?.chapters || []).filter((ch) => {
    if (ch.order <= covered) return false;
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return row?.reviewState === "reviewed";
  }).length;
}

export function needsConsistencyCheckup(
  project: Pick<NovelProject, "outline" | "chapters" | "lastConsistencyReport">,
  threshold = 10
): boolean {
  return reviewedSinceLastCheck(project) >= threshold;
}

export function findWriteNextChapter(
  project: Pick<NovelProject, "outline" | "chapters">,
  currentId?: string | null
): OutlineChapter | null {
  const chapters = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  if (!chapters.length) return null;
  const unwritten = chapters.filter((ch) => {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    return !row?.content?.trim();
  });
  if (currentId) {
    const current = chapters.find((c) => c.id === currentId);
    if (current) {
      const after = unwritten.find((c) => c.order > current.order);
      if (after) return after;
      const curRow = project.chapters.find((c) => c.chapterId === current.id);
      if (!curRow?.content?.trim()) return current;
    }
  }
  return unwritten[0] || chapters[0];
}

export function sortChaptersForDailyNav(
  chapters: OutlineChapter[],
  rows: ChapterContent[]
): OutlineChapter[] {
  return [...chapters].sort((a, b) => {
    const ra = rows.find((c) => c.chapterId === a.id);
    const rb = rows.find((c) => c.chapterId === b.id);
    const ua = Boolean(ra?.content?.trim()) && ra?.reviewState !== "reviewed";
    const ub = Boolean(rb?.content?.trim()) && rb?.reviewState !== "reviewed";
    if (ua !== ub) return ua ? -1 : 1;
    return a.order - b.order;
  });
}

export function chapterHasUpstreamRepair(
  chapterOrder: number,
  marks?: AccountRepairMark[] | null
): boolean {
  return (marks || []).some((m) => chapterOrder > m.afterChapterOrder);
}

export function pushAccountRepairMark(
  marks: AccountRepairMark[] | undefined,
  afterChapterOrder: number,
  kind: AccountRepairMark["kind"]
): AccountRepairMark[] {
  const next = [...(marks || [])];
  const at = new Date().toISOString();
  const idx = next.findIndex(
    (m) => m.afterChapterOrder === afterChapterOrder && m.kind === kind
  );
  const row: AccountRepairMark = { afterChapterOrder, at, kind };
  if (idx >= 0) next[idx] = row;
  else next.push(row);
  return next;
}

export function defaultOpeningTab(
  stored: string | null | undefined,
  project: Pick<NovelProject, "outline" | "original">
): ProjectTab {
  const hasOutline = Boolean(project.outline?.chapters?.length);
  const hasOriginal = Boolean(
    project.original &&
      typeof project.original === "object" &&
      (project.original.text || project.original.title)
  );
  if (!stored || stored === "characters") {
    if (hasOutline) return "chapters";
    return hasOriginal ? "original" : "premise";
  }
  if (stored === "premise") return "premise";
  if (isProjectTab(stored)) return stored;
  if (hasOutline) return "chapters";
  return hasOriginal ? "original" : "premise";
}

export function threadSortRank(
  t: PlotThread,
  orderById: Map<string, number>,
  writtenMax: number
): number {
  if (isPlotThreadOverdue(t, orderById, writtenMax)) return 0;
  if (t.status !== "resolved" && !t.dueVolumeId) return 1;
  return 2;
}
