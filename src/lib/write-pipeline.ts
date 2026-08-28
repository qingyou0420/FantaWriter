import { applyPendingDeltasToLedger, applyThreadQuickAction } from "./finalize-chapter";
import type {
  ChapterContent,
  NovelProject,
  OutlineChapter,
  PendingStateDelta,
  WriteRun,
  WriteRunPhase,
  WriteRunSnapshot,
} from "./types";
import { pushChapterVersion } from "./types";

export type PrecheckLevel = "ok" | "warn" | "block";

export type PrecheckItem = {
  id: string;
  level: PrecheckLevel;
  message: string;
};

export type PrecheckResult = {
  ok: boolean;
  items: PrecheckItem[];
  chapter: OutlineChapter | null;
};

export function findStaleWriteRuns(project: NovelProject): WriteRun[] {
  return (project.writeRuns || []).filter((r) => r.status === "running");
}

export function precheckWriteNext(
  project: NovelProject,
  chapterId: string | undefined,
  opts?: {
    hasApiKey?: boolean;
    bookJobRunning?: boolean;
    storageWritable?: boolean;
  }
): PrecheckResult {
  const items: PrecheckItem[] = [];
  const chapters = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  const chapter =
    (chapterId && chapters.find((c) => c.id === chapterId)) ||
    chapters.find((c) => {
      const row = project.chapters.find((r) => r.chapterId === c.id);
      return !row?.content?.trim();
    }) ||
    null;

  if (opts?.hasApiKey === false) {
    items.push({
      id: "api",
      level: "block",
      message: "尚未配置 API Key，无法写章。",
    });
  }
  if (!chapter) {
    items.push({
      id: "chapter",
      level: "block",
      message: "大纲里没有可写的下一章。",
    });
  }
  const intent = (project.premiseCard?.premise || project.outline?.premise || "").trim();
  if (!intent) {
    items.push({
      id: "intent",
      level: "warn",
      message: "作者意图为空。旧稿迁入可以继续，但建议先补前提。",
    });
  }
  if (!(project.characters || []).some((c) => c.name.trim())) {
    items.push({
      id: "cast",
      level: "warn",
      message: "还没有已命名人物。",
    });
  }
  if (!project.outline?.chapters?.length) {
    items.push({
      id: "outline",
      level: "block",
      message: "还没有大纲。",
    });
  }
  if (findStaleWriteRuns(project).length) {
    items.push({
      id: "lock",
      level: "block",
      message: "上次写章未完成，请先还原快照或清除锁。",
    });
  }
  if (opts?.bookJobRunning || project.bookJob?.status === "running") {
    items.push({
      id: "job",
      level: "block",
      message: "批量任务进行中，同一项目同时只允许一个写章运行。",
    });
  }
  if (opts?.storageWritable === false) {
    items.push({
      id: "storage",
      level: "block",
      message: "存储不可写。请先导出 JSON。",
    });
  }

  return {
    ok: items.every((i) => i.level !== "block"),
    items,
    chapter,
  };
}

export function takeWriteSnapshot(
  project: NovelProject,
  chapterId: string
): WriteRunSnapshot {
  const row = project.chapters.find((c) => c.chapterId === chapterId);
  return {
    chapterId,
    content: row?.content || "",
    summary: row?.summary,
    touchedThreads: row?.touchedThreads,
    pendingStateDeltas: row?.pendingStateDeltas,
    reviewState: row?.reviewState,
    characterStates: JSON.parse(JSON.stringify(project.characterStates || {})),
    plotThreads: JSON.parse(JSON.stringify(project.plotThreads || [])),
    bookJob: project.bookJob ? JSON.parse(JSON.stringify(project.bookJob)) : null,
  };
}

export function beginWriteRun(
  project: NovelProject,
  chapterId: string,
  opts?: { skipReview?: boolean }
): NovelProject {
  const snapshot = takeWriteSnapshot(project, chapterId);
  const chapters = project.chapters.map((c) =>
    c.chapterId === chapterId && c.content?.trim()
      ? pushChapterVersion(c, "before-write-run")
      : c
  );
  const run: WriteRun = {
    id: crypto.randomUUID(),
    chapterId,
    status: "running",
    phase: "precheck",
    startedAt: new Date().toISOString(),
    snapshot,
    skipReview: Boolean(opts?.skipReview) || undefined,
  };
  const rest = (project.writeRuns || []).filter((r) => r.status !== "running");
  return { ...project, chapters, writeRuns: [run, ...rest] };
}

export function patchWriteRun(
  project: NovelProject,
  patch: Partial<WriteRun>
): NovelProject {
  const runs = [...(project.writeRuns || [])];
  const idx = runs.findIndex((r) => r.status === "running");
  if (idx < 0) return project;
  runs[idx] = { ...runs[idx], ...patch };
  return { ...project, writeRuns: runs };
}

export function setWriteRunPhase(
  project: NovelProject,
  phase: WriteRunPhase
): NovelProject {
  return patchWriteRun(project, { phase });
}

export function activeWriteRun(project: NovelProject): WriteRun | undefined {
  return (project.writeRuns || []).find((r) => r.status === "running");
}

function restoreSnapshot(
  project: NovelProject,
  snapshot: WriteRunSnapshot
): NovelProject {
  const chapters = project.chapters.map((c) => {
    if (c.chapterId !== snapshot.chapterId) return c;
    return {
      ...c,
      content: snapshot.content,
      summary: snapshot.summary,
      touchedThreads: snapshot.touchedThreads,
      pendingStateDeltas: snapshot.pendingStateDeltas,
      reviewState: snapshot.reviewState,
      status: snapshot.content?.trim() ? "done" : "idle",
      error: undefined,
    } as ChapterContent;
  });
  return {
    ...project,
    chapters,
    characterStates: snapshot.characterStates,
    plotThreads: snapshot.plotThreads,
    bookJob: snapshot.bookJob,
  };
}

export function rollbackWriteRun(
  project: NovelProject,
  opts?: { runId?: string; status?: WriteRun["status"]; error?: string }
): NovelProject {
  const run = opts?.runId
    ? (project.writeRuns || []).find((r) => r.id === opts.runId)
    : activeWriteRun(project);
  if (!run?.snapshot) {
    return patchWriteRun(project, {
      status: opts?.status || "rolled_back",
      endedAt: new Date().toISOString(),
      error: opts?.error,
    });
  }
  const restored = restoreSnapshot(project, run.snapshot);
  return {
    ...restored,
    writeRuns: (restored.writeRuns || []).map((r) =>
      r.id === run.id
        ? {
            ...r,
            status: opts?.status || "rolled_back",
            endedAt: new Date().toISOString(),
            error: opts?.error,
          }
        : r
    ),
  };
}

export function clearWriteLock(
  project: NovelProject,
  runId?: string
): NovelProject {
  return {
    ...project,
    writeRuns: (project.writeRuns || []).map((r) =>
      r.status === "running" && (!runId || r.id === runId)
        ? { ...r, status: "aborted", endedAt: new Date().toISOString() }
        : r
    ),
  };
}

export function commitWriteRun(project: NovelProject): NovelProject {
  return patchWriteRun(project, {
    status: "committed",
    phase: "commit",
    endedAt: new Date().toISOString(),
  });
}

export function latestUndoableWriteRun(
  project: NovelProject,
  chapterId?: string
): WriteRun | undefined {
  return (project.writeRuns || []).find(
    (r) =>
      r.status === "committed" &&
      r.snapshot &&
      (!chapterId || r.chapterId === chapterId)
  );
}

/** 用写前快照撤销最近一次已提交写章（含账本/伏笔）。 */
export function undoCommittedWriteRun(
  project: NovelProject,
  runId?: string
): NovelProject {
  const run = runId
    ? (project.writeRuns || []).find((r) => r.id === runId)
    : latestUndoableWriteRun(project);
  if (!run?.snapshot || run.status !== "committed") return project;
  return rollbackWriteRun(project, {
    runId: run.id,
    status: "rolled_back",
    error: "作者撤销本次写章",
  });
}

export function markSettlePending(
  project: NovelProject,
  error?: string
): NovelProject {
  return patchWriteRun(project, {
    status: "settle_pending",
    phase: "settle",
    endedAt: new Date().toISOString(),
    error,
  });
}

export function keepPartialDraft(
  project: NovelProject,
  chapterId: string,
  partial: string,
  error?: string
): NovelProject {
  const chapters = project.chapters.map((c) =>
    c.chapterId === chapterId
      ? {
          ...c,
          content: partial || c.content,
          status: (partial ? "done" : c.status) as ChapterContent["status"],
          error,
        }
      : c
  );
  return patchWriteRun(
    { ...project, chapters },
    {
      status: "failed",
      phase: "draft",
      endedAt: new Date().toISOString(),
      error,
      charsOut: (partial || "").length,
    }
  );
}

export function applySettleToProject(opts: {
  project: NovelProject;
  chapterId: string;
  chapterOrder: number;
  summary: string;
  deltas: PendingStateDelta[];
  touchedThreads?: string[];
  summaryFailed?: boolean;
}): NovelProject {
  const chapters = opts.project.chapters.map((c) => {
    if (c.chapterId !== opts.chapterId) return c;
    return {
      ...c,
      summary: opts.summaryFailed ? c.summary : opts.summary,
      summaryFailed: Boolean(opts.summaryFailed) || undefined,
      touchedThreads: opts.touchedThreads,
      pendingStateDeltas: opts.deltas.length ? opts.deltas : undefined,
    };
  });
  let plotThreads = opts.project.plotThreads || [];
  for (const title of opts.touchedThreads || []) {
    plotThreads = applyThreadQuickAction(
      plotThreads,
      title,
      "active",
      opts.chapterId
    );
  }
  return {
    ...opts.project,
    chapters,
    plotThreads,
    characterStates: applyPendingDeltasToLedger(
      opts.project.characterStates,
      opts.chapterOrder,
      opts.deltas
    ),
  };
}

export function recoverStaleWriteRuns(project: NovelProject): {
  project: NovelProject;
  stale: WriteRun[];
} {
  const stale = findStaleWriteRuns(project);
  return { project, stale };
}
