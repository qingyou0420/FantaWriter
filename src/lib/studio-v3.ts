import { normalizeOutlineTree, type OutlineTree } from "./outline-tree";
import type {
  ChapterReview,
  ConsistencyReport,
  CurrentFocus,
  NovelProject,
  Volume,
  WordTargets,
  WriteRun,
  CanonDraft,
  StudioSession,
} from "./types";

export function createEmptyCurrentFocus(): CurrentFocus {
  return {
    stageGoal: "",
    mustKeep: [],
    mustAvoid: [],
    source: "author",
  };
}

export function currentFocusFromVolume(volume?: Volume | null): CurrentFocus {
  const goal = (volume?.arcGoal || "").trim();
  const exit = (volume?.exitState || "").trim();
  if (!goal && !exit) return createEmptyCurrentFocus();
  const bits = [
    goal && `弧线目标：${goal}`,
    exit && `出卷局面：${exit}`,
  ].filter(Boolean);
  return {
    stageGoal: `${bits.join("；")}（迁移生成，请修改）`,
    mustKeep: [],
    mustAvoid: [],
    source: "migrated",
  };
}

function normalizeCurrentFocus(
  raw: CurrentFocus | undefined,
  volumes: Volume[] | undefined
): CurrentFocus {
  if (raw && typeof raw === "object") {
    const source = raw.source === "migrated" ? "migrated" : "author";
    return {
      stageGoal: String(raw.stageGoal || ""),
      mustKeep: Array.isArray(raw.mustKeep)
        ? raw.mustKeep.map((s) => String(s).trim()).filter(Boolean)
        : [],
      mustAvoid: Array.isArray(raw.mustAvoid)
        ? raw.mustAvoid.map((s) => String(s).trim()).filter(Boolean)
        : [],
      source,
    };
  }
  const current = [...(volumes || [])].sort((a, b) => a.order - b.order)[0];
  return currentFocusFromVolume(current);
}

function normalizeWordTargets(raw: WordTargets | undefined): WordTargets {
  if (!raw || typeof raw !== "object") return {};
  const book =
    typeof raw.book === "number" && Number.isFinite(raw.book) && raw.book > 0
      ? Math.round(raw.book)
      : undefined;
  const byVolume: Record<string, number> = {};
  if (raw.byVolume && typeof raw.byVolume === "object") {
    for (const [id, n] of Object.entries(raw.byVolume)) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) {
        byVolume[id] = Math.round(n);
      }
    }
  }
  return {
    book,
    byVolume: Object.keys(byVolume).length ? byVolume : undefined,
  };
}

function reviewFromConsistency(
  report: ConsistencyReport | null | undefined
): ChapterReview[] {
  if (!report) return [];
  return [
    {
      id: `legacy-consistency:${report.at || "unknown"}`,
      chapterId: "",
      at: report.at || "",
      score: typeof report.score === "number" ? report.score : 0,
      source: "legacy_consistency",
      issues: (report.issues || []).map((iss) => ({
        dimension: "legacy_consistency",
        severity:
          iss.severity === "high" || iss.severity === "medium"
            ? iss.severity
            : "low",
        title: String(iss.detail || "一致性意见"),
        evidence: String(iss.character || iss.chapter || ""),
        suggestion: String(iss.suggestion || ""),
        locatable: Boolean(iss.chapter),
      })),
    },
  ];
}

function normalizeReviews(
  raw: ChapterReview[] | undefined,
  last: ConsistencyReport | null | undefined
): ChapterReview[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .filter((r): r is ChapterReview => Boolean(r && typeof r === "object"))
      .map((r) => ({
        id: r.id || crypto.randomUUID(),
        chapterId: String(r.chapterId || ""),
        at: String(r.at || ""),
        score: typeof r.score === "number" && Number.isFinite(r.score) ? r.score : 0,
        source:
          r.source === "legacy_consistency" || r.source === "legacy_reviewed"
            ? r.source
            : "pipeline",
        skipped: Boolean(r.skipped) || undefined,
        issues: Array.isArray(r.issues)
          ? r.issues.map((iss) => ({
              dimension: String(iss.dimension || ""),
              severity:
                iss.severity === "high" || iss.severity === "medium"
                  ? iss.severity
                  : "low",
              title: String(iss.title || ""),
              evidence: String(iss.evidence || ""),
              suggestion: String(iss.suggestion || ""),
              locatable: Boolean(iss.locatable),
            }))
          : [],
      }));
  }
  return reviewFromConsistency(last);
}

function normalizeWriteRuns(raw: WriteRun[] | undefined): WriteRun[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is WriteRun => Boolean(r && typeof r === "object"));
}

function normalizeDrafts(raw: CanonDraft[] | undefined): CanonDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is CanonDraft => Boolean(d && typeof d === "object"));
}

function normalizeSessions(raw: StudioSession[] | undefined): StudioSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is StudioSession => Boolean(s && typeof s === "object"));
}

/**
 * 在 v2 字段已规范化之后补齐 v3 视图字段。
 * 不搬迁正文 / 账本 / 章序的住址，只加分组与闸门所需的并列字段。
 */
export function applySchemaV3(project: NovelProject): NovelProject {
  const fallbackVol =
    project.volumes?.[0]?.id || `${project.id}:vol:1`;
  const outlineTree: OutlineTree = normalizeOutlineTree(
    project.outlineTree,
    project.volumes,
    project.outline?.chapters,
    fallbackVol
  );
  return {
    ...project,
    schemaVersion: 3,
    currentFocus: normalizeCurrentFocus(project.currentFocus, project.volumes),
    outlineTree,
    wordTargets: normalizeWordTargets(project.wordTargets),
    reviews: normalizeReviews(project.reviews, project.lastConsistencyReport),
    writeRuns: normalizeWriteRuns(project.writeRuns),
    canonDrafts: normalizeDrafts(project.canonDrafts),
    sessions: normalizeSessions(project.sessions),
    lastAuthorCanonEditAt:
      typeof project.lastAuthorCanonEditAt === "string"
        ? project.lastAuthorCanonEditAt
        : undefined,
  };
}
