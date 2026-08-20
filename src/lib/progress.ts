import type { GenerationSettings, NovelProject } from "./types";

/** 按篇幅设定的每章目标字数（中文字符，去空白） */
export function chapterTargetChars(
  length: GenerationSettings["length"]
): { min: number; max: number; target: number } {
  switch (length) {
    case "short":
      return { min: 800, max: 1500, target: 1200 };
    case "long":
      return { min: 3000, max: 5000, target: 4000 };
    default:
      return { min: 1500, max: 3000, target: 2200 };
  }
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
  const { min, max, target } = chapterTargetChars(project.settings.length);
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
