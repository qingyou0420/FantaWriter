import type {
  Character,
  NovelProject,
  Outline,
  PlotThread,
  PremiseCard,
} from "./types";
import { isReaderKnownThread } from "./types";

/** 红线字段：这些原文不得出现在任何生成路径的组装产物里 */
export type AuthorSecretBag = {
  theme: string[];
  endingDirection: string[];
  truth: string[];
  authorOnlyThreads: string[];
  destinationNotes: string[];
  coreConflict: string[];
};

function pushUnique(list: string[], value: string | undefined) {
  const s = String(value || "").trim();
  if (s && !list.includes(s)) list.push(s);
}

export function collectAuthorSecrets(
  project: Pick<
    NovelProject,
    "premiseCard" | "characters" | "plotThreads" | "outline"
  >
): AuthorSecretBag {
  const bag: AuthorSecretBag = {
    theme: [],
    endingDirection: [],
    truth: [],
    authorOnlyThreads: [],
    destinationNotes: [],
    coreConflict: [],
  };
  const card = project.premiseCard;
  if (card) {
    pushUnique(bag.theme, card.theme);
    pushUnique(bag.endingDirection, card.endingDirection);
    pushUnique(bag.coreConflict, card.coreConflict);
  }
  for (const c of project.characters || []) {
    const t = c.truth;
    if (!t) continue;
    pushUnique(bag.truth, t.surfaceWant);
    pushUnique(bag.truth, t.realNeed);
    pushUnique(bag.truth, t.fatalFlaw);
    pushUnique(bag.truth, t.bottomLine);
  }
  for (const thread of project.plotThreads || []) {
    if (isReaderKnownThread(thread)) {
      pushUnique(bag.destinationNotes, thread.destinationNote);
      continue;
    }
    pushUnique(bag.authorOnlyThreads, thread.title);
    pushUnique(bag.authorOnlyThreads, thread.note);
    pushUnique(bag.destinationNotes, thread.destinationNote);
  }
  return bag;
}

export function flattenAuthorSecrets(bag: AuthorSecretBag): string[] {
  return [
    ...bag.theme,
    ...bag.endingDirection,
    ...bag.truth,
    ...bag.authorOnlyThreads,
    ...bag.destinationNotes,
    ...bag.coreConflict,
  ];
}

export function secretHitsInText(text: string, secrets: string[]): string[] {
  const blob = String(text || "");
  return secrets.filter((s) => s && blob.includes(s));
}

/** 可注入的一句话前提：前提卡优先，否则大纲 premise */
export function injectablePremise(
  premiseCard?: PremiseCard | null,
  outline?: Outline | null
): string {
  return (premiseCard?.premise || outline?.premise || "").trim();
}

/**
 * 勾选「本次把结局方向给 AI 参考」时才返回前提卡的结局方向。
 * 永不回落到 outline.endingNote。
 */
export function injectableEndingDirection(
  include: boolean | undefined,
  premiseCard?: PremiseCard | null
): string {
  if (!include) return "";
  return String(premiseCard?.endingDirection || "").trim();
}

/** 勾选且前提卡有结局方向时才拼进提示词；默认空串 */
export function formatEndingDirectionLine(
  include?: boolean,
  endingDirection?: string
): string {
  if (!include) return "";
  const line = String(endingDirection || "").trim();
  return line ? `结局方向（仅本次参考）：${line}` : "";
}

export function globalForbidList(premiseCard?: PremiseCard | null): string[] {
  return (premiseCard?.forbidList || []).map((s) => s.trim()).filter(Boolean);
}

export function readerKnownOpenThreadTitles(
  threads?: PlotThread[] | null
): string[] {
  return (threads || [])
    .filter(
      (t) => t.status !== "resolved" && isReaderKnownThread(t) && t.title.trim()
    )
    .map((t) => t.title.trim());
}

export function formatOpenThreadsForOutline(
  threads: PlotThread[] | undefined,
  extra?: (t: PlotThread) => string
): string[] {
  return (threads || [])
    .filter(
      (t) => t.status !== "resolved" && isReaderKnownThread(t) && t.title.trim()
    )
    .map((t) => {
      const suffix = extra?.(t) || "";
      return `- ${t.title}${t.note ? `：${t.note}` : ""}${suffix}`;
    });
}

/** 人物扩写/优化前剥掉真相层，避免误把对象整段序列化进上下文 */
export function characterWithoutTruth(c: Character): Character {
  const { truth: _truth, ...rest } = c;
  return { ...rest, truth: undefined };
}

export function charactersWithoutTruth(list?: Character[]): Character[] {
  return (list || []).map(characterWithoutTruth);
}
