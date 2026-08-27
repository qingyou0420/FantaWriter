import { LENGTH_RANGES, type GenerationSettings, type NovelProject } from "./types";

/** 按篇幅设定的每章目标字数（中文字符，去空白）；区间单源 LENGTH_RANGES */
export function chapterTargetChars(
  length: GenerationSettings["length"],
  custom?: GenerationSettings["customLength"]
): { min: number; max: number; target: number } {
  const range =
    custom && custom.min < custom.max
      ? custom
      : LENGTH_RANGES[length] || LENGTH_RANGES.medium;
  return {
    min: range.min,
    max: range.max,
    target: Math.round((range.min + range.max) / 2),
  };
}

export function countChars(text: string): number {
  return (text || "").replace(/\s/g, "").length;
}

export interface ChapterProgressRow {
  chapterId: string;
  order: number;
  title: string;
  words: number;
  target: number;
  min: number;
  max: number;
  status: string;
  /** 相对 target 的完成比例 0–1+ */
  ratio: number;
}

export interface BookProgress {
  rows: ChapterProgressRow[];
  totalWords: number;
  targetTotal: number;
  doneChapters: number;
  totalChapters: number;
  percentOfTarget: number;
  percentChapters: number;
}

export function buildBookProgress(project: NovelProject): BookProgress {
  const { min, max, target } = chapterTargetChars(
    project.settings.length,
    project.settings.customLength
  );
  const outline = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];

  const rows: ChapterProgressRow[] = outline.map((ch) => {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    const words = countChars(row?.content || "");
    return {
      chapterId: ch.id,
      order: ch.order,
      title: ch.title,
      words,
      target,
      min,
      max,
      status: row?.status || "idle",
      ratio: target > 0 ? words / target : 0,
    };
  });

  const totalWords = rows.reduce((n, r) => n + r.words, 0);
  const totalChapters = rows.length;
  const doneChapters = rows.filter((r) => r.words > 0).length;
  const targetTotal = target * Math.max(totalChapters, 1);
  const percentOfTarget = targetTotal
    ? Math.min(999, Math.round((totalWords / targetTotal) * 100))
    : 0;
  const percentChapters = totalChapters
    ? Math.round((doneChapters / totalChapters) * 100)
    : 0;

  return {
    rows,
    totalWords,
    targetTotal: target * totalChapters,
    doneChapters,
    totalChapters,
    percentOfTarget,
    percentChapters,
  };
}

export function countCharsLast7Days(project: NovelProject, now = Date.now()): number {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  let words = 0;
  for (const ch of project.chapters || []) {
    const updated = Date.parse(ch.updatedAt || "");
    if (!Number.isFinite(updated) || updated < cutoff) continue;
    words += countChars(ch.content || "");
  }
  return words;
}

/** 存稿=已审/已完成且未发布；已发布=有 publishedAt */
export function serialBoardStats(project: NovelProject, now = Date.now()) {
  const outline = project.outline?.chapters || [];
  let backlog = 0;
  let published = 0;
  for (const ch of outline) {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    if (!row) continue;
    if (row.publishedAt) {
      published += 1;
      continue;
    }
    const ready =
      row.reviewState === "reviewed" ||
      (row.status === "done" && Boolean(row.content?.trim()));
    if (ready) backlog += 1;
  }
  return {
    backlog,
    published,
    wordsLast7Days: countCharsLast7Days(project, now),
  };
}
