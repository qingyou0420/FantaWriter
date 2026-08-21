import { forbiddenClaimsFromStatement, lockedCanonFacts } from "./original";
import {
  isReaderKnownThread,
  type ChapterScene,
  type LockedCanonFact,
  type PlotThread,
} from "./types";

export interface BeatContract {
  mustKeepLocks: string[];
  forbiddenClaims: string[];
  advanceThreadIds: string[];
  darkThreadIds: string[];
  verbatimAnchors: string[];
}

export interface BeatCommitDeltas {
  summary?: string;
  touchedThreadIds: string[];
  timelineNote?: string;
  itemProposals: { name: string; statement: string }[];
  canonProposals: LockedCanonFact[];
}

export function readerKnownThreads(threads?: PlotThread[] | null): PlotThread[] {
  return (threads || []).filter(isReaderKnownThread);
}

export function authorOnlyThreads(threads?: PlotThread[] | null): PlotThread[] {
  return (threads || []).filter((t) => !isReaderKnownThread(t));
}

export function chapterAdvanceableThreads(
  threads: PlotThread[] | undefined,
  scene?: Pick<ChapterScene, "threadIds">
): PlotThread[] {
  const open = readerKnownThreads(threads).filter((t) => t.status !== "resolved");
  const ids = scene?.threadIds || [];
  if (!ids.length) return open;
  return open.filter((t) => ids.includes(t.id));
}

export function buildBeatContract(opts: {
  canon?: LockedCanonFact[] | null;
  threads?: PlotThread[] | null;
  scene?: Pick<ChapterScene, "threadIds" | "verbatimAnchors">;
}): BeatContract {
  const locks = lockedCanonFacts(opts.canon);
  const mustKeepLocks = locks
    .map((f) => {
      const name = f.name || "（未命名）";
      return `【${name}】${f.statement || ""}`.trim();
    })
    .filter(Boolean);
  const forbiddenClaims: string[] = [];
  const seen = new Set<string>();
  for (const f of locks) {
    for (const claim of forbiddenClaimsFromStatement(f.statement)) {
      const line = `「${f.name}」不是${claim}`;
      if (!seen.has(line)) {
        seen.add(line);
        forbiddenClaims.push(line);
      }
    }
  }
  const dark = authorOnlyThreads(opts.threads).filter(
    (t) => t.status !== "resolved"
  );
  return {
    mustKeepLocks,
    forbiddenClaims,
    advanceThreadIds: chapterAdvanceableThreads(opts.threads || [], opts.scene).map(
      (t) => t.id
    ),
    darkThreadIds: dark.map((t) => t.id),
    verbatimAnchors: (opts.scene?.verbatimAnchors || [])
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function formatBeatContract(
  contract: BeatContract,
  threads?: PlotThread[] | null
): string {
  const byId = new Map((threads || []).map((t) => [t.id, t]));
  const advance = contract.advanceThreadIds
    .map((id) => byId.get(id))
    .filter((t): t is PlotThread => Boolean(t))
    .map((t) => `- ${t.title}${t.note ? `：${t.note}` : ""}`);
  const dark = contract.darkThreadIds
    .map((id) => byId.get(id))
    .filter((t): t is PlotThread => Boolean(t))
    .map((t) => `- ${t.title}${t.note ? `：${t.note}` : ""}`);
  const parts = ["## 本拍契约（硬性）"];
  if (contract.mustKeepLocks.length) {
    parts.push("必须遵守的锁定：", ...contract.mustKeepLocks.map((s) => `- ${s}`));
  }
  if (contract.forbiddenClaims.length) {
    parts.push("禁止写成：", ...contract.forbiddenClaims.map((s) => `- ${s}`));
  }
  if (advance.length) {
    parts.push("本章可推进的线索：", ...advance);
  }
  if (dark.length) {
    parts.push(
      "暗线（仅作者可见，正文不得提前泄漏）：",
      ...dark
    );
  }
  if (contract.verbatimAnchors.length) {
    parts.push(
      "原句锚点（必须原样出现，润色不得改写）：",
      ...contract.verbatimAnchors.map((s) => `- ${s}`)
    );
  }
  return parts.join("\n");
}

export function missingVerbatimAnchors(
  text: string,
  anchors?: string[] | null
): string[] {
  return (anchors || []).filter((a) => a.trim() && !text.includes(a));
}

export function collectChapterAnchors(scenes?: ChapterScene[] | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const scene of scenes || []) {
    for (const a of scene.verbatimAnchors || []) {
      const s = a.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

/** 从已接受正文里提议增量；不发明物品或锁定，等人确认后再提交 */
export function proposeBeatDeltas(opts: {
  draft: string;
  scene?: Pick<ChapterScene, "summary" | "threadIds">;
  threads?: PlotThread[] | null;
}): BeatCommitDeltas {
  const mentioned = (opts.threads || []).filter(
    (t) => t.title.trim() && opts.draft.includes(t.title.trim())
  );
  const allowed = new Set(opts.scene?.threadIds || []);
  const touched = mentioned.filter(
    (t) => isReaderKnownThread(t) && (!allowed.size || allowed.has(t.id))
  );
  return {
    summary: opts.scene?.summary?.trim() || undefined,
    touchedThreadIds: touched.map((t) => t.id),
    itemProposals: [],
    canonProposals: [],
  };
}

export function incomingCanonDeltas(
  existing: LockedCanonFact[],
  incoming: LockedCanonFact[]
): LockedCanonFact[] {
  const keyOf = (f: LockedCanonFact) =>
    `${f.name.trim()}|${f.statement.trim()}`;
  const seen = new Set(existing.map(keyOf));
  const nameLocked = new Set(
    existing.filter((f) => f.locked && f.name).map((f) => f.name)
  );
  return incoming.filter((f) => {
    if (!f.name && !f.statement) return false;
    if (seen.has(keyOf(f))) return false;
    if (f.name && nameLocked.has(f.name)) return false;
    return true;
  });
}
