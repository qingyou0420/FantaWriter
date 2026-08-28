import { syncOutlineTree } from "./outline-tree";
import type {
  CanonDraft,
  CanonDraftKind,
  Character,
  LoreEntry,
  NovelProject,
  Outline,
  PlotThread,
  PremiseCard,
  CurrentFocus,
  StoryBackground,
} from "./types";

export type CanonFieldChange = {
  path: string;
  label: string;
  before: string;
  after: string;
};

export type CanonProposal = {
  id: string;
  kind: CanonDraftKind;
  summary: string;
  createdAt: string;
  changes: CanonFieldChange[];
  /** 确认后要合并进项目的补丁（只含正典相关字段） */
  patch: Partial<
    Pick<
      NovelProject,
      | "premiseCard"
      | "currentFocus"
      | "background"
      | "characters"
      | "lore"
      | "outline"
      | "plotThreads"
      | "outlineTree"
    >
  >;
};

export type CanonConfirmation =
  | { source: "author" }
  | { token: string; acceptedAt: string };

const issuedTokens = new Set<string>();

export function createCanonConfirmation(): CanonConfirmation {
  const token = crypto.randomUUID();
  issuedTokens.add(token);
  return { token, acceptedAt: new Date().toISOString() };
}

export function consumeCanonConfirmation(token: string): boolean {
  if (!issuedTokens.has(token)) return false;
  issuedTokens.delete(token);
  return true;
}

export function isAuthorConfirmation(
  confirmation: CanonConfirmation | undefined | null
): confirmation is { source: "author" } {
  return Boolean(confirmation && "source" in confirmation && confirmation.source === "author");
}

function assertConfirmation(confirmation: CanonConfirmation | undefined | null) {
  if (isAuthorConfirmation(confirmation)) return;
  if (
    confirmation &&
    "token" in confirmation &&
    confirmation.token &&
    consumeCanonConfirmation(confirmation.token)
  ) {
    return;
  }
  throw new Error("CANON_WRITE_REQUIRES_CONFIRMATION");
}

export function markAuthorCanonEdit(project: NovelProject): NovelProject {
  return {
    ...project,
    lastAuthorCanonEditAt: new Date().toISOString(),
  };
}

export function enqueueCanonDraft(
  project: NovelProject,
  proposal: CanonProposal
): NovelProject {
  const draft: CanonDraft = {
    id: proposal.id,
    kind: proposal.kind,
    createdAt: proposal.createdAt,
    status: "pending",
    summary: proposal.summary,
    proposalId: proposal.id,
    changes: proposal.changes,
    patch: proposal.patch as Record<string, unknown>,
  };
  const rest = (project.canonDrafts || []).filter((d) => d.id !== proposal.id);
  return { ...project, canonDrafts: [draft, ...rest] };
}

export function proposalFromCanonDraft(
  draft: CanonDraft
): CanonProposal | null {
  if (!draft.patch || typeof draft.patch !== "object") return null;
  return {
    id: draft.proposalId || draft.id,
    kind: draft.kind,
    summary: draft.summary,
    createdAt: draft.createdAt,
    changes: Array.isArray(draft.changes) ? draft.changes : [],
    patch: draft.patch as CanonProposal["patch"],
  };
}

export function pendingCanonProposals(project: NovelProject): CanonProposal[] {
  return (project.canonDrafts || [])
    .filter((d) => d.status === "pending")
    .map(proposalFromCanonDraft)
    .filter((p): p is CanonProposal => Boolean(p));
}

function setPatchPath(
  patch: CanonProposal["patch"],
  path: string,
  after: string
) {
  const segs = path.split(".");
  if (segs[0] === "outline" && patch.outline) {
    if (segs[1] === "premise") patch.outline.premise = after;
    if (segs[1] === "endingNote") patch.outline.endingNote = after;
    if (segs[1] === "chapters" && segs[2] && segs[3]) {
      patch.outline.chapters = patch.outline.chapters.map((c) =>
        c.id === segs[2] ? { ...c, [segs[3]]: after } : c
      );
    }
  }
  if (segs[0] === "premiseCard" && patch.premiseCard && segs[1]) {
    if (segs[1] === "forbidList") {
      patch.premiseCard.forbidList = after
        .split(/[；;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      (patch.premiseCard as unknown as Record<string, unknown>)[segs[1]] = after;
    }
  }
  if (segs[0] === "currentFocus" && patch.currentFocus && segs[1] === "stageGoal") {
    patch.currentFocus.stageGoal = after;
  }
  if (segs[0] === "background" && patch.background && segs[1]) {
    (patch.background as unknown as Record<string, unknown>)[segs[1]] = after;
  }
  if (segs[0] === "characters" && segs[1] && patch.characters) {
    try {
      const parsed = JSON.parse(after) as Character;
      patch.characters = patch.characters.map((c) =>
        c.id === segs[1] || c.id === parsed.id ? { ...c, ...parsed, id: c.id } : c
      );
    } catch {
      /* 展示串改了但不是 JSON，保留原 patch 对象 */
    }
  }
}

/** 把闸上编辑过的「新值」写回 changes 与可识别的 patch 字段。 */
export function proposalWithEditedAfters(
  proposal: CanonProposal,
  afters: Record<string, string>
): CanonProposal {
  const changes = proposal.changes.map((c) => ({
    ...c,
    after: afters[c.path] ?? c.after,
  }));
  const patch = structuredClone(proposal.patch);
  for (const c of changes) {
    setPatchPath(patch, c.path, c.after);
  }
  return { ...proposal, changes, patch };
}

export function settleCanonDraft(
  project: NovelProject,
  proposalId: string,
  status: "accepted" | "rejected"
): NovelProject {
  return {
    ...project,
    canonDrafts: (project.canonDrafts || []).map((d) =>
      d.id === proposalId || d.proposalId === proposalId ? { ...d, status } : d
    ),
  };
}

/**
 * AI 正典写入的唯一落库入口。没有作者确认或闸门 token 会抛错。
 * 手工编辑请走 markAuthorCanonEdit + 直接 update，不要走这里。
 */
export function applyCanonProposal(
  project: NovelProject,
  proposal: CanonProposal,
  confirmation: CanonConfirmation
): NovelProject {
  assertConfirmation(confirmation);
  let next: NovelProject = {
    ...project,
    ...proposal.patch,
  };
  if (proposal.patch.outline) {
    const fallback = next.volumes?.[0]?.id || `${next.id}:vol:1`;
    next = {
      ...next,
      outlineTree: syncOutlineTree(
        next.outlineTree,
        next.volumes,
        next.outline?.chapters,
        fallback
      ),
    };
  }
  return settleCanonDraft(next, proposal.id, "accepted");
}

export function rejectCanonProposal(
  project: NovelProject,
  proposal: CanonProposal
): NovelProject {
  return settleCanonDraft(project, proposal.id, "rejected");
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function diffFields(
  rows: { path: string; label: string; before: unknown; after: unknown }[]
): CanonFieldChange[] {
  return rows
    .map((r) => ({
      path: r.path,
      label: r.label,
      before: str(r.before),
      after: str(r.after),
    }))
    .filter((r) => r.before !== r.after);
}

export function proposalFromOutline(opts: {
  kind: Extract<CanonDraftKind, "outline" | "outline_volume" | "outline_next">;
  before: Outline | null | undefined;
  after: Outline;
  summary?: string;
}): CanonProposal {
  const beforeCh = (opts.before?.chapters || [])
    .map((c) => `${c.order}.${c.title}`)
    .join(" / ");
  const afterCh = (opts.after.chapters || [])
    .map((c) => `${c.order}.${c.title}`)
    .join(" / ");
  return {
    id: crypto.randomUUID(),
    kind: opts.kind,
    summary: opts.summary || `大纲提案：${opts.after.chapters.length} 章`,
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: "outline.premise",
        label: "前提",
        before: opts.before?.premise,
        after: opts.after.premise,
      },
      {
        path: "outline.endingNote",
        label: "结局备注",
        before: opts.before?.endingNote,
        after: opts.after.endingNote,
      },
      {
        path: "outline.chapters",
        label: "章节目录",
        before: beforeCh,
        after: afterCh,
      },
    ]),
    patch: { outline: opts.after },
  };
}

export function proposalFromCharacters(opts: {
  kind: Extract<CanonDraftKind, "character" | "cast">;
  before: Character[];
  after: Character[];
  background?: StoryBackground;
  summary?: string;
}): CanonProposal {
  const names = (list: Character[]) =>
    list.map((c) => c.name || c.id).join("、");
  return {
    id: crypto.randomUUID(),
    kind: opts.kind,
    summary: opts.summary || `${opts.kind === "cast" ? "群像" : "人物"}提案`,
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: "characters",
        label: "人物",
        before: names(opts.before),
        after: names(opts.after),
      },
      ...opts.after.map((c, i) => ({
        path: `characters.${c.id || i}`,
        label: c.name || `人物 ${i + 1}`,
        before: JSON.stringify(opts.before.find((x) => x.id === c.id) || {}),
        after: JSON.stringify(c),
      })),
    ]),
    patch: {
      characters: opts.after.map((c) => ({ ...c, confirmed: false })),
      ...(opts.background ? { background: opts.background } : {}),
    },
  };
}

export function proposalFromBackground(opts: {
  before: StoryBackground;
  after: StoryBackground;
}): CanonProposal {
  return {
    id: crypto.randomUUID(),
    kind: "foundation",
    summary: "故事基础提案",
    createdAt: new Date().toISOString(),
    changes: diffFields(
      (["title", "synopsis", "setting", "era", "themes", "tone", "extra"] as const).map(
        (key) => ({
          path: `background.${key}`,
          label: key,
          before: opts.before[key],
          after: opts.after[key],
        })
      )
    ),
    patch: { background: opts.after },
  };
}

export function proposalFromPremise(opts: {
  before?: PremiseCard;
  after: PremiseCard;
}): CanonProposal {
  return {
    id: crypto.randomUUID(),
    kind: "intent",
    summary: "作者意图提案",
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: "premiseCard.premise",
        label: "前提",
        before: opts.before?.premise,
        after: opts.after.premise,
      },
      {
        path: "premiseCard.forbidList",
        label: "禁写",
        before: (opts.before?.forbidList || []).join("；"),
        after: opts.after.forbidList.join("；"),
      },
    ]),
    patch: { premiseCard: opts.after },
  };
}

export function proposalFromFocus(opts: {
  before?: CurrentFocus;
  after: CurrentFocus;
}): CanonProposal {
  return {
    id: crypto.randomUUID(),
    kind: "focus",
    summary: "创作罗盘提案",
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: "currentFocus.stageGoal",
        label: "阶段目标",
        before: opts.before?.stageGoal,
        after: opts.after.stageGoal,
      },
    ]),
    patch: { currentFocus: { ...opts.after, source: "author" } },
  };
}

export function proposalFromLore(opts: {
  before: LoreEntry[] | undefined;
  after: LoreEntry[];
}): CanonProposal {
  return {
    id: crypto.randomUUID(),
    kind: "world",
    summary: "世界设定提案",
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: "lore",
        label: "世界观条目",
        before: (opts.before || []).map((l) => l.title).join("、"),
        after: opts.after.map((l) => l.title).join("、"),
      },
    ]),
    patch: { lore: opts.after },
  };
}

export function proposalFromThreads(opts: {
  before: PlotThread[] | undefined;
  after: PlotThread[];
}): CanonProposal {
  return {
    id: crypto.randomUUID(),
    kind: "thread",
    summary: "线索板提案",
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: "plotThreads",
        label: "伏笔",
        before: (opts.before || []).map((t) => t.title).join("、"),
        after: opts.after.map((t) => t.title).join("、"),
      },
    ]),
    patch: { plotThreads: opts.after },
  };
}

export function proposalFromPolishedChapter(opts: {
  outline: Outline;
  chapterId: string;
  beforeTitle: string;
  after: { title: string; summary: string; keyPoints: string; intensityNote?: string };
}): CanonProposal {
  const chapters = opts.outline.chapters.map((c) =>
    c.id === opts.chapterId
      ? {
          ...c,
          title: opts.after.title || c.title,
          summary: opts.after.summary || c.summary,
          keyPoints: opts.after.keyPoints || c.keyPoints,
          intensityNote: opts.after.intensityNote || c.intensityNote,
        }
      : c
  );
  return {
    id: crypto.randomUUID(),
    kind: "polish_chapter",
    summary: `润色大纲：${opts.after.title || opts.beforeTitle}`,
    createdAt: new Date().toISOString(),
    changes: diffFields([
      {
        path: `outline.chapters.${opts.chapterId}.title`,
        label: "章题",
        before: opts.beforeTitle,
        after: opts.after.title,
      },
      {
        path: `outline.chapters.${opts.chapterId}.summary`,
        label: "大纲摘要",
        before: opts.outline.chapters.find((c) => c.id === opts.chapterId)?.summary,
        after: opts.after.summary,
      },
    ]),
    patch: { outline: { ...opts.outline, chapters } },
  };
}
