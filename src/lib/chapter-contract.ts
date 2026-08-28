import { formatStateDeltaNote } from "./character-states";
import { formatCharacterStateLedger } from "./character-states";
import { globalForbidList, injectablePremise } from "./author-secrets";
import type {
  Character,
  CharacterStateLedger,
  NovelProject,
  OutlineChapter,
} from "./types";

export type ChapterContractInput = {
  chapter: OutlineChapter;
  globalForbid?: string[];
  ledger?: CharacterStateLedger;
  characters?: Character[];
  previousSnippet?: string;
  previousHook?: string;
};

export function chapterGoalText(chapter: Pick<OutlineChapter, "summary" | "keyPoints">): string {
  return [chapter.summary, chapter.keyPoints].map((s) => String(s || "").trim()).filter(Boolean).join("\n");
}

export function chapterForbidLines(
  chapter: Pick<OutlineChapter, "forbidList">,
  globalForbid?: string[]
): { global: string[]; local: string[]; all: string[] } {
  const global = (globalForbid || []).map((s) => s.trim()).filter(Boolean);
  const local = (chapter.forbidList || []).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const all: string[] = [];
  for (const line of [...global, ...local]) {
    if (seen.has(line)) continue;
    seen.add(line);
    all.push(line);
  }
  return { global, local, all };
}

export function chapterContractGate(opts: {
  chapter: Pick<OutlineChapter, "summary" | "keyPoints" | "forbidList">;
  globalForbid?: string[];
  confirmedEmptyForbid?: boolean;
}): {
  emptyGoal: boolean;
  emptyForbid: boolean;
  canGenerate: boolean;
  needConfirmEmptyForbid: boolean;
} {
  const emptyGoal = !chapterGoalText(opts.chapter);
  const { all } = chapterForbidLines(opts.chapter, opts.globalForbid);
  const emptyForbid = all.length === 0;
  return {
    emptyGoal,
    emptyForbid,
    canGenerate: !emptyGoal && (!emptyForbid || Boolean(opts.confirmedEmptyForbid)),
    needConfirmEmptyForbid: emptyForbid && !opts.confirmedEmptyForbid,
  };
}

export function formatChapterContract(opts: ChapterContractInput): string {
  const { chapter } = opts;
  const { global, local, all } = chapterForbidLines(chapter, opts.globalForbid);
  const castIds = (chapter.castIds || []).filter(Boolean);
  const cast = castIds.length
    ? (opts.characters || []).filter((c) => castIds.includes(c.id))
    : opts.characters || [];
  const castNames = cast.map((c) => c.name).filter(Boolean);
  const ledger = formatCharacterStateLedger(opts.ledger, castNames, 3);
  const parts = ["## 本章契约"];
  const goal = chapterGoalText(chapter);
  if (goal) {
    parts.push("要写什么：", goal);
  }
  if (chapter.hook?.trim()) {
    parts.push(`章末钩子：${chapter.hook.trim()}`);
  }
  if (castNames.length) {
    parts.push(`出场人物：${castNames.join("、")}`);
  }
  if (chapter.timePlace?.trim()) {
    parts.push(`时间与地点：${chapter.timePlace.trim()}`);
  }
  if (ledger) {
    parts.push("约束现状（出场人物账本）：", ledger);
  }
  if (all.length) {
    parts.push("不能写什么：");
    if (global.length) {
      parts.push("全书禁写：", ...global.map((s) => `- 禁止写：${s}`));
    }
    if (local.length) {
      parts.push("本章禁写：", ...local.map((s) => `- 禁止写：${s}`));
    }
  }
  if (opts.previousHook?.trim()) {
    parts.push(`上章钩子：${opts.previousHook.trim()}`);
  }
  if (opts.previousSnippet?.trim()) {
    parts.push(
      "上章结尾（衔接用）：",
      opts.previousSnippet.trim().slice(-1000)
    );
  }
  return parts.join("\n");
}

export function buildChapterContractFromProject(
  project: Pick<
    NovelProject,
    | "premiseCard"
    | "outline"
    | "characters"
    | "characterStates"
    | "chapters"
    | "settings"
  >,
  chapter: OutlineChapter
): string {
  const outlineChs = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  const prev = [...outlineChs].reverse().find((c) => c.order < chapter.order);
  const prevRow = prev
    ? project.chapters.find((c) => c.chapterId === prev.id)
    : undefined;
  return formatChapterContract({
    chapter,
    globalForbid: globalForbidList(project.premiseCard),
    ledger: project.characterStates,
    characters: project.characters,
    previousSnippet: prevRow?.content?.slice(-1000),
    previousHook: prev?.hook,
  });
}

export function chapterAssembleExtras(
  project: Pick<
    NovelProject,
    | "premiseCard"
    | "outline"
    | "characters"
    | "characterStates"
    | "chapters"
    | "settings"
  >,
  chapter: OutlineChapter
): {
  premise: string;
  chapterContractBlock: string;
  injectFullOutline: boolean;
  includeEndingDirection: boolean;
} {
  return {
    premise: injectablePremise(project.premiseCard, project.outline),
    chapterContractBlock: buildChapterContractFromProject(project, chapter),
    injectFullOutline: Boolean(project.settings?.injectFullOutline),
    includeEndingDirection: false,
  };
}

export { formatStateDeltaNote };
