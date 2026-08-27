import { forbiddenClaimsFromStatement, lockedCanonFacts } from "./original";
import { createEmptyLoreEntry } from "./lore";
import {
  isReaderKnownThread,
  type ChapterContent,
  type ChapterScene,
  type LockedCanonFact,
  type LoreEntry,
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
const TIME_WORD =
  /昨夜|今日|次日|翌日|三天后|那年|月初|月底|春天|夏天|秋天|冬天|凌晨|黄昏|午后|傍晚|黎明|\d+月|\d+日|甲子|戌时|子时/;

export function extractTimelineNote(draft: string): string | undefined {
  const hits = String(draft || "")
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s && TIME_WORD.test(s));
  if (!hits.length) return undefined;
  return hits.slice(0, 2).join("。");
}

export function mergeBeatChapterSummary(
  existing: string | undefined,
  sceneOrder: number,
  sceneSummary: string | undefined
): string {
  const beat = sceneSummary?.trim();
  if (!beat) return existing || "";
  const line = `【拍${sceneOrder}】${beat}`;
  const cur = (existing || "").trim();
  if (!cur) return line;
  if (cur.includes(`【拍${sceneOrder}】`)) {
    return cur.replace(new RegExp(`【拍${sceneOrder}】[^\\n]*`), line);
  }
  return `${cur}\n${line}`;
}

export function upsertTimelineLore(
  lore: LoreEntry[] | undefined,
  note: string
): LoreEntry[] {
  const text = note.trim();
  if (!text) return lore || [];
  const list = [...(lore || [])];
  const idx = list.findIndex((e) => e.title.trim() === "时间线");
  if (idx >= 0) {
    const prev = list[idx].body?.trim();
    list[idx] = {
      ...list[idx],
      body: prev ? `${prev}\n${text}` : text,
      keys: Array.from(new Set([...(list[idx].keys || []), "时间线"])),
      enabled: true,
    };
    return list;
  }
  return [
    ...list,
    {
      ...createEmptyLoreEntry("时间线"),
      body: text,
      keys: ["时间线"],
      category: "other",
      enabled: true,
    },
  ];
}

export function applyBeatCommitDeltas(
  chapter: ChapterContent,
  deltas: BeatCommitDeltas,
  scene?: Pick<ChapterScene, "order" | "summary">
): ChapterContent {
  const summary = mergeBeatChapterSummary(
    chapter.summary,
    scene?.order ?? 0,
    deltas.summary || scene?.summary
  );
  return {
    ...chapter,
    summary,
  };
}

export function applyBeatDeltasToProject(opts: {
  chapters: ChapterContent[];
  lore?: LoreEntry[];
  threads?: PlotThread[] | null;
  chapterId: string;
  deltas: BeatCommitDeltas;
  scene?: Pick<ChapterScene, "order" | "summary">;
}): { chapters: ChapterContent[]; lore: LoreEntry[] } {
  const chapters = opts.chapters.map((c) => {
    if (c.chapterId !== opts.chapterId) return c;
    const next = applyBeatCommitDeltas(c, opts.deltas, opts.scene);
    const touched = (opts.threads || [])
      .filter((t) => opts.deltas.touchedThreadIds.includes(t.id))
      .map((t) => t.title);
    return {
      ...next,
      touchedThreads: touched.length ? touched : c.touchedThreads,
    };
  });
  const lore = opts.deltas.timelineNote?.trim()
    ? upsertTimelineLore(opts.lore, opts.deltas.timelineNote)
    : opts.lore || [];
  return { chapters, lore };
}

export function proposeBeatDeltas(opts: {
  draft: string;
  scene?: Pick<ChapterScene, "summary" | "threadIds" | "order">;
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
    timelineNote: extractTimelineNote(opts.draft),
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
