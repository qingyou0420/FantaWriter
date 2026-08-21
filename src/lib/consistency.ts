import type { ConsistencyReport, NovelProject } from "./types";

export type ConsistencyChapterRow = {
  order: number;
  title: string;
  summary: string;
  content: string;
};

/** 自动/手动一致性检查共用：带摘要、不截断章数 */
export function buildConsistencyRows(
  project: Pick<NovelProject, "outline" | "chapters">
): ConsistencyChapterRow[] {
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  return chapters
    .map((ch) => {
      const row = project.chapters.find((c) => c.chapterId === ch.id);
      const summary = row?.summary || "";
      const body = row?.content || "";
      if (!summary.trim() && !body.trim()) return null;
      return {
        order: ch.order,
        title: ch.title,
        summary,
        content: body,
      };
    })
    .filter(Boolean) as ConsistencyChapterRow[];
}

export function toConsistencyReport(
  result: {
    score?: number;
    summary?: string;
    issues?: ConsistencyReport["issues"];
  } | null
    | undefined
): ConsistencyReport {
  return {
    at: new Date().toISOString(),
    score: typeof result?.score === "number" ? result.score : 0,
    summary: String(result?.summary || ""),
    issues: Array.isArray(result?.issues) ? result.issues : [],
  };
}
