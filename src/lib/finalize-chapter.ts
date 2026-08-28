import {
  mergeCharacterStates,
  type CharacterStateDelta,
} from "./character-states";
import type {
  ChapterContent,
  CharacterStateLedger,
  NovelProject,
  PendingStateDelta,
  PlotThread,
  PlotThreadStatus,
} from "./types";

export type FinalizeStepId = "summary" | "ledger" | "threads";

export type FinalizeProgress = {
  summary: boolean;
  ledger: boolean;
  threads: boolean;
};

export function emptyFinalizeProgress(): FinalizeProgress {
  return { summary: false, ledger: false, threads: false };
}

export function canMarkReviewed(progress: FinalizeProgress): boolean {
  return Boolean(progress.summary && progress.ledger && progress.threads);
}

export function applyPendingDeltasToLedger(
  ledger: CharacterStateLedger | undefined,
  chapterOrder: number,
  deltas: PendingStateDelta[] | CharacterStateDelta[],
  pinnedNames?: string[]
): CharacterStateLedger {
  const merged = mergeCharacterStates(ledger, chapterOrder, deltas);
  if (!pinnedNames?.length) return merged;
  const pin = new Set(pinnedNames.map((n) => n.trim()).filter(Boolean));
  const next: CharacterStateLedger = { ...merged };
  for (const [name, rows] of Object.entries(next)) {
    next[name] = rows.map((row) =>
      row.chapterOrder === chapterOrder && pin.has(name)
        ? { ...row, pinned: true }
        : row
    );
  }
  return next;
}

export function applyThreadQuickAction(
  threads: PlotThread[] | undefined,
  title: string,
  action: "active" | "resolved" | "keep",
  chapterId?: string
): PlotThread[] {
  const name = title.trim();
  if (!name || action === "keep") return threads || [];
  const status: PlotThreadStatus = action === "resolved" ? "resolved" : "active";
  return (threads || []).map((t) => {
    if (t.title.trim() !== name) return t;
    return {
      ...t,
      status,
      resolveChapterId:
        action === "resolved" ? chapterId || t.resolveChapterId : t.resolveChapterId,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function plantNewThread(
  threads: PlotThread[] | undefined,
  title: string,
  chapterId?: string
): PlotThread[] {
  const now = new Date().toISOString();
  const name = title.trim();
  if (!name) return threads || [];
  if ((threads || []).some((t) => t.title.trim() === name)) return threads || [];
  return [
    {
      id: crypto.randomUUID(),
      title: name,
      note: "",
      status: "planted",
      plantChapterId: chapterId,
      createdAt: now,
      updatedAt: now,
      visibility: "reader_known",
      kind: "foreshadow",
    },
    ...(threads || []),
  ];
}

export function clearPendingAfterConfirm(chapter: ChapterContent): ChapterContent {
  return { ...chapter, pendingStateDeltas: undefined };
}

export function projectAfterFinalize(opts: {
  project: NovelProject;
  chapterId: string;
  chapterOrder: number;
  summary: string;
  deltas: PendingStateDelta[];
  pinnedNames?: string[];
  threadActions?: { title: string; action: "active" | "resolved" | "keep" }[];
  newThreadTitle?: string;
}): NovelProject {
  const chapters = opts.project.chapters.map((c) => {
    if (c.chapterId !== opts.chapterId) return c;
    return {
      ...c,
      summary: opts.summary,
      reviewState: "reviewed" as const,
      pendingStateDeltas: undefined,
    };
  });
  let plotThreads = opts.project.plotThreads || [];
  for (const act of opts.threadActions || []) {
    plotThreads = applyThreadQuickAction(
      plotThreads,
      act.title,
      act.action,
      opts.chapterId
    );
  }
  if (opts.newThreadTitle?.trim()) {
    plotThreads = plantNewThread(plotThreads, opts.newThreadTitle, opts.chapterId);
  }
  return {
    ...opts.project,
    chapters,
    plotThreads,
    characterStates: applyPendingDeltasToLedger(
      opts.project.characterStates,
      opts.chapterOrder,
      opts.deltas,
      opts.pinnedNames
    ),
  };
}
