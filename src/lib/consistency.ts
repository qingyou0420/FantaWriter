import type { ConsistencyReport, NovelProject } from "./types";

export type ConsistencyScope = "volume" | "recent" | "all" | "sinceLast";

export type ConsistencyScopeOpts = {
  scope?: ConsistencyScope;
  volumeId?: string;
  recentCount?: number;
  coveredUpTo?: number;
};

export type ConsistencyChapterRow = {
  order: number;
  title: string;
  summary: string;
  content: string;
};

/** 自动/手动一致性检查共用：带摘要、不截断章数 */
export function buildConsistencyRows(
  project: Pick<NovelProject, "outline" | "chapters" | "volumes">,
  opts?: ConsistencyScopeOpts
): ConsistencyChapterRow[] {
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  const scope = opts?.scope || "all";
  const recentCount = opts?.recentCount ?? 8;
  const filtered = chapters.filter((ch) => {
    if (scope === "volume") {
      const fallback = project.volumes?.[0]?.id;
      const volId = opts?.volumeId || fallback;
      return (ch.volumeId || fallback) === volId;
    }
    if (scope === "recent") {
      const max = chapters[chapters.length - 1]?.order || 0;
      return ch.order > max - recentCount;
    }
    if (scope === "sinceLast") {
      const since = opts?.coveredUpTo ?? 0;
      return ch.order > since;
    }
    return true;
  });
  return filtered
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
    | undefined,
  coveredUpTo?: number
): ConsistencyReport {
  return {
    at: new Date().toISOString(),
    score: typeof result?.score === "number" ? result.score : 0,
    summary: String(result?.summary || ""),
    issues: Array.isArray(result?.issues) ? result.issues : [],
    coveredUpTo:
      typeof coveredUpTo === "number" && Number.isFinite(coveredUpTo)
        ? coveredUpTo
        : undefined,
  };
}
