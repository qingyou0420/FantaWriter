import { extractJsonObject } from "./prompts";
import { sampleTextForStyleLearning } from "./types";
import type {
  CanonKind,
  Character,
  LockedCanonFact,
  LoreEntry,
  NovelProject,
  OriginalManuscript,
} from "./types";

export const ORIGINAL_EXCERPT_MAX = 7000;
export const ORIGINAL_GROUNDING_HEADING = "原作摘录（须忠实）";
export const LOCKED_CANON_HEADING = "锁定设定（原作焕新，硬性）";
export const ORIGINAL_SYSTEM_RULE = `你正在「原作焕新」：扩写/润色旧稿，不是从零编造。
必须遵守「锁定设定」：不得改写身份、物种、性别、从属关系。锁定条目优先于常识推断。
生成内容不得与作者写下的锁定说明冲突。
忠实的是情节、身份、事实与锁定设定；文笔、节奏、句式、描写以文风指南和写作参数为准，允许并鼓励重写原句，禁止照搬原稿里需要焕新的写法。`;

const CANON_KIND_LABEL: Record<CanonKind, string> = {
  character: "人物",
  identity: "身份",
  relationship: "关系",
  place: "地点",
  item: "物品",
  fact: "事实",
};

export function hasOriginalText(
  original?: OriginalManuscript | null
): boolean {
  return Boolean(original?.text?.trim());
}

export function lockedCanonFacts(
  facts?: LockedCanonFact[] | null
): LockedCanonFact[] {
  return (facts || []).filter((f) => f.locked !== false && (f.name || f.statement));
}

export function hasLockedCanon(facts?: LockedCanonFact[] | null): boolean {
  return lockedCanonFacts(facts).length > 0;
}

export function hasOriginalGrounding(
  project: Pick<NovelProject, "original" | "canon">
): boolean {
  return hasOriginalText(project.original) || hasLockedCanon(project.canon);
}

export function formatLockedCanon(facts?: LockedCanonFact[] | null): string {
  const locked = lockedCanonFacts(facts);
  if (!locked.length) return "";
  return locked
    .map((f) => {
      const kind = CANON_KIND_LABEL[f.kind] || f.kind;
      const name = f.name || "（未命名）";
      const aliases = f.aliases?.length ? `（亦称：${f.aliases.join("、")}）` : "";
      return `- 【${kind}·${name}】${aliases}${f.statement || ""}`.trim();
    })
    .join("\n");
}

function findAllIndexes(text: string, term: string): number[] {
  const out: number[] = [];
  if (!term.trim()) return out;
  let from = 0;
  while (from < text.length) {
    const i = text.indexOf(term, from);
    if (i < 0) break;
    out.push(i);
    from = i + Math.max(1, term.length);
  }
  return out;
}

function windowsAround(
  text: string,
  term: string,
  radius = 280,
  limit = 3,
  preferNear?: number
): { start: number; end: number }[] {
  const hits = findAllIndexes(text, term);
  if (!hits.length) return [];
  const ranked =
    preferNear == null
      ? hits
      : [...hits].sort(
          (a, b) => Math.abs(a - preferNear) - Math.abs(b - preferNear)
        );
  const nearby =
    preferNear == null
      ? ranked
      : ranked.filter((i) => Math.abs(i - preferNear) <= text.length * 0.35);
  const picked = (nearby.length ? nearby : ranked.slice(0, 1)).slice(0, limit);
  return picked.map((i) => ({
    start: Math.max(0, i - radius),
    end: Math.min(text.length, i + term.length + radius),
  }));
}

function mergeWindows(
  windows: { start: number; end: number }[]
): { start: number; end: number }[] {
  if (!windows.length) return [];
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (const w of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (w.start <= last.end + 40) {
      last.end = Math.max(last.end, w.end);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

export function canonSearchKeys(facts?: LockedCanonFact[] | null): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const f of facts || []) {
    for (const k of [f.name, ...(f.aliases || [])]) {
      const s = String(k || "").trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        keys.push(s);
      }
    }
  }
  return keys;
}

export function selectOriginalExcerpts(
  text: string,
  keys: string[] = [],
  maxChars = ORIGINAL_EXCERPT_MAX,
  opts?: { chapterOrder?: number; chapterCount?: number }
): string {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return "";
  if (clean.length <= maxChars) return clean;

  const order = Math.max(1, Number(opts?.chapterOrder) || 1);
  const total = Math.max(1, Number(opts?.chapterCount) || 1);
  const ratio = Math.min(1, Math.max(0, (order - 0.5) / total));
  const focus = Math.floor(clean.length * ratio);
  const regionRadius = 700;
  const windows: { start: number; end: number }[] = [
    {
      start: Math.max(0, focus - regionRadius),
      end: Math.min(clean.length, focus + regionRadius),
    },
  ];
  for (const key of keys.filter(Boolean)) {
    windows.push(...windowsAround(clean, key, 280, 3, focus));
  }
  const merged = mergeWindows(windows);
  const ranked = [...merged].sort((a, b) => {
    const da = Math.abs((a.start + a.end) / 2 - focus);
    const db = Math.abs((b.start + b.end) / 2 - focus);
    return da - db;
  });
  const chosen: { start: number; end: number }[] = [];
  let used = 0;
  for (const w of ranked) {
    const slice = clean.slice(w.start, w.end).trim();
    if (!slice) continue;
    const chunk =
      (w.start > 0 ? "…" : "") +
      slice +
      (w.end < clean.length ? "…" : "");
    if (used + chunk.length > maxChars) {
      const nearFocus =
        Math.abs((w.start + w.end) / 2 - focus) <= clean.length * 0.35;
      const remain = maxChars - used;
      if (nearFocus && remain > 80) {
        chosen.push({
          start: w.start,
          end: Math.min(w.end, w.start + remain),
        });
      }
      break;
    }
    chosen.push(w);
    used += chunk.length + 2;
  }
  if (!chosen.length) {
    return sampleTextForStyleLearning(clean, maxChars);
  }
  const parts: string[] = [];
  for (const w of mergeWindows(chosen)) {
    const slice = clean.slice(w.start, w.end).trim();
    if (!slice) continue;
    parts.push(
      (w.start > 0 ? "…" : "") +
        slice +
        (w.end < clean.length ? "…" : "")
    );
  }
  const joined = parts.join("\n\n");
  return joined.length > maxChars ? joined.slice(0, maxChars) + "…" : joined;
}

export function queryFromGeneratePayload(
  payload: Record<string, unknown>
): string {
  const parts: string[] = [];
  const ch = payload.character as
    | { name?: string; aliases?: string[] }
    | undefined;
  if (ch?.name) parts.push(ch.name);
  if (ch?.aliases?.length) parts.push(...ch.aliases);
  const chapter = payload.chapter as
    | { title?: string; summary?: string; keyPoints?: string }
    | undefined;
  if (chapter) {
    parts.push(chapter.title || "", chapter.summary || "", chapter.keyPoints || "");
  }
  if (payload.seed) parts.push(String(payload.seed));
  if (payload.instruction) parts.push(String(payload.instruction));
  if (payload.selectedText) parts.push(String(payload.selectedText).slice(0, 200));
  return parts.filter(Boolean).join("\n");
}

function addNameKeys(
  keys: string[],
  seen: Set<string>,
  name?: string,
  aliases?: string[]
) {
  for (const raw of [name, ...(aliases || [])]) {
    const s = String(raw || "").trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      keys.push(s);
    }
  }
}

/** 检索词只用名称/别名/世界观 keys，不再把章摘要整句切进去 */
export function excerptKeysFromPayload(
  payload: Record<string, unknown>,
  facts?: LockedCanonFact[] | null
): string[] {
  const keys = [...canonSearchKeys(facts)];
  const seen = new Set(keys);

  const single = payload.character as
    | { name?: string; aliases?: string[] }
    | undefined;
  addNameKeys(keys, seen, single?.name, single?.aliases);

  const characters = payload.characters as
    | { name?: string; aliases?: string[] }[]
    | undefined;
  if (Array.isArray(characters)) {
    for (const c of characters) {
      addNameKeys(keys, seen, c?.name, c?.aliases);
    }
  }

  const loreEntries = (payload.loreEntries || payload.lore) as
    | LoreEntry[]
    | undefined;
  if (Array.isArray(loreEntries)) {
    for (const entry of loreEntries) {
      if (!entry || typeof entry !== "object") continue;
      addNameKeys(keys, seen, entry.title, entry.keys);
    }
  }

  return keys;
}

export function buildOriginalGrounding(opts: {
  original?: OriginalManuscript | null;
  canon?: LockedCanonFact[] | null;
  queryKeys?: string[];
  chapterOrder?: number;
  chapterCount?: number;
}): string {
  const locked = formatLockedCanon(opts.canon);
  const excerpts = hasOriginalText(opts.original)
    ? selectOriginalExcerpts(
        opts.original!.text,
        opts.queryKeys || canonSearchKeys(opts.canon),
        ORIGINAL_EXCERPT_MAX,
        {
          chapterOrder: opts.chapterOrder,
          chapterCount: opts.chapterCount,
        }
      )
    : "";
  if (!locked && !excerpts) return "";

  const parts: string[] = [];
  if (locked) {
    parts.push(
      `## ${LOCKED_CANON_HEADING}`,
      "下列条目已由作者锁定，生成时必须遵守，禁止改写物种/性别/从属。",
      locked
    );
  }
  if (excerpts) {
    const title = opts.original?.title?.trim();
    const src = opts.original?.sourceLabel?.trim();
    const label = [title && `《${title}》`, src].filter(Boolean).join(" · ");
    parts.push(
      `## ${ORIGINAL_GROUNDING_HEADING}`,
      label ? `来源：${label}` : "来源：作者粘贴的原作底稿",
      "下列摘录只供核对情节与事实，文笔须按文风指南重写，不要照抄原句。",
      excerpts
    );
  }
  return parts.join("\n");
}

export function originalContextFrom(
  project: Pick<NovelProject, "original" | "canon">
): { original?: OriginalManuscript; canon?: LockedCanonFact[] } {
  const original = hasOriginalText(project.original)
    ? project.original!
    : undefined;
  const canon = Array.isArray(project.canon) ? project.canon : [];
  const out: { original?: OriginalManuscript; canon?: LockedCanonFact[] } = {};
  if (original) out.original = original;
  if (canon.length) out.canon = canon;
  return out;
}

export function attachOriginalContext<T extends Record<string, unknown>>(
  project: Pick<NovelProject, "original" | "canon">,
  body: T
): T & { original?: OriginalManuscript; canon?: LockedCanonFact[] } {
  const extra = originalContextFrom(project);
  if (!extra.original && !extra.canon) return body;
  return { ...body, ...extra };
}

const SKIP_ORIGINAL_INJECT = new Set([
  "extract_canon",
  "extract_skeleton",
  "learn_style",
]);

export function injectOriginalGrounding(
  assembled: { system: string; user: string },
  task: string,
  payload: Record<string, unknown>
): { system: string; user: string } {
  if (SKIP_ORIGINAL_INJECT.has(task)) return assembled;
  const original = payload.original as OriginalManuscript | undefined;
  const canon = payload.canon as LockedCanonFact[] | undefined;
  if (!hasOriginalText(original) && !hasLockedCanon(canon)) {
    return assembled;
  }
  const chapter = payload.chapter as { order?: number } | undefined;
  const outline = payload.outline as { chapters?: unknown[] } | undefined;
  const block = buildOriginalGrounding({
    original,
    canon,
    queryKeys: excerptKeysFromPayload(payload, canon),
    chapterOrder: chapter?.order,
    chapterCount: Array.isArray(outline?.chapters)
      ? outline.chapters.length
      : undefined,
  });
  if (!block) return assembled;
  return {
    system: `${assembled.system}\n\n## 原作焕新（硬性）\n${ORIGINAL_SYSTEM_RULE}`,
    user: `${block}\n\n${assembled.user}`,
  };
}

const CLAIM_TRAIL_RE = /[。．.！!？?）)】\]]+$/;

/** 从用户锁定说明里抽出否定禁区，供通用违规检测。 */
export function forbiddenClaimsFromStatement(statement: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re =
    /不是([^，。；、/\s]{1,16})|非(?!常|得|法)([^，。；、/\s]{1,8})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(statement || "")) !== null) {
    const raw = (m[1] || m[2] || "").replace(CLAIM_TRAIL_RE, "").trim();
    if (raw && !seen.has(raw)) {
      seen.add(raw);
      out.push(raw);
    }
  }
  return out;
}

function claimMatchesText(claim: string, text: string): boolean {
  if (!claim || !text) return false;
  if (text.includes(claim)) return true;
  if (
    claim.length >= 2 &&
    claim.endsWith("性") &&
    text.includes(claim.slice(0, -1))
  ) {
    return true;
  }
  return false;
}

function factMatchesName(
  fact: LockedCanonFact,
  name: string
): boolean {
  const n = name.trim();
  if (!n) return false;
  if (fact.name === n) return true;
  return (fact.aliases || []).some((a) => a === n);
}

function characterCanonBlob(c: Partial<Character>): string {
  return [c.gender, c.role, c.appearance, c.personality, c.notes]
    .filter(Boolean)
    .join("\n");
}

export function detectCharacterCanonViolations(
  character: Partial<Character>,
  facts?: LockedCanonFact[] | null
): string[] {
  const locked = lockedCanonFacts(facts);
  const name = String(character.name || "").trim();
  if (!name) return [];
  const blob = characterCanonBlob(character);
  const hits: string[] = [];
  for (const f of locked) {
    if (!factMatchesName(f, name)) continue;
    for (const claim of forbiddenClaimsFromStatement(f.statement)) {
      if (claimMatchesText(claim, blob)) {
        hits.push(
          `「${name}」已锁定「不是${claim}」（${f.statement}），不能写成与此冲突的内容`
        );
      }
    }
  }
  return [...new Set(hits)];
}

export function detectCanonViolations(
  text: string,
  facts?: LockedCanonFact[] | null
): string[] {
  const locked = lockedCanonFacts(facts);
  const raw = text || "";
  const hits: string[] = [];
  for (const f of locked) {
    const names = [f.name, ...(f.aliases || [])].filter(Boolean);
    if (!names.length) continue;
    const claims = forbiddenClaimsFromStatement(f.statement);
    if (!claims.length) continue;
    for (const name of names) {
      if (!raw.includes(name)) continue;
      const around = windowsAround(raw, name, 36, 8)
        .map((w) => raw.slice(w.start, w.end))
        .join("\n");
      for (const claim of claims) {
        if (claimMatchesText(claim, around)) {
          hits.push(
            `「${name}」已锁定「不是${claim}」（${f.statement}），正文与锁定冲突`
          );
        }
      }
    }
  }
  return [...new Set(hits)];
}

export function assertCharacterRespectsCanon(
  character: Partial<Character>,
  facts?: LockedCanonFact[] | null
): void {
  const v = detectCharacterCanonViolations(character, facts);
  if (v.length) {
    throw new CanonViolationError(v);
  }
}

export function assertCharactersRespectCanon(
  characters: Partial<Character>[],
  facts?: LockedCanonFact[] | null
): void {
  const all: string[] = [];
  for (const c of characters || []) {
    all.push(...detectCharacterCanonViolations(c, facts));
  }
  const unique = [...new Set(all)];
  if (unique.length) throw new CanonViolationError(unique);
}

export class CanonViolationError extends Error {
  code = "CANON_VIOLATION";
  violations: string[];
  constructor(violations: string[]) {
    super(`已拦截：与锁定设定冲突。${violations.join("；")}`);
    this.violations = violations;
  }
}

export function buildExtractCanonUserPrompt(opts: {
  sampleText: string;
  titleHint?: string;
}): string {
  return `请从下列原作正文中抽取「不可改写」的设定条目，供后续焕新/扩写时锁定。
只抽取原文已经写明的身份、物种、从属、地名、明确事实；不要编造，不要补全原文没说的事。
名称在原文里若指地点、器物或其他非角色存在，须在 statement 写明原文身份，避免后续被当成角色。

## 原作标题提示
${opts.titleHint || "（未命名）"}

## 原作采样
${opts.sampleText}

## 输出 JSON（不要 markdown）
{
  "facts": [
    {
      "name": "名称，如霜桥",
      "kind": "character|identity|relationship|place|fact 之一",
      "statement": "一句锁定说明，如：北城城门，地点而非角色",
      "aliases": ["可选别名"]
    }
  ]
}`;
}

export function parseCanonFacts(text: string): LockedCanonFact[] {
  const data = JSON.parse(extractJsonObject(text)) as {
    facts?: Array<Record<string, unknown>>;
  };
  const kinds: CanonKind[] = [
    "character",
    "identity",
    "relationship",
    "place",
    "item",
    "fact",
  ];
  return (data.facts || [])
    .map((f) => {
      const kind = kinds.includes(f.kind as CanonKind)
        ? (f.kind as CanonKind)
        : "fact";
      const aliases = Array.isArray(f.aliases)
        ? f.aliases.map((a) => String(a).trim()).filter(Boolean)
        : [];
      return {
        id: crypto.randomUUID(),
        name: String(f.name || "").trim(),
        kind,
        statement: String(f.statement || "").trim(),
        locked: true,
        aliases,
      } satisfies LockedCanonFact;
    })
    .filter((f) => f.name || f.statement);
}

export function mergeCanonFacts(
  existing: LockedCanonFact[],
  incoming: LockedCanonFact[]
): LockedCanonFact[] {
  const out = [...existing];
  const keyOf = (f: LockedCanonFact) =>
    `${f.name.trim()}|${f.statement.trim()}`;
  const seen = new Set(out.map(keyOf));
  const nameLocked = new Set(
    out.filter((f) => f.locked && f.name).map((f) => f.name)
  );
  for (const f of incoming) {
    if (!f.name && !f.statement) continue;
    if (seen.has(keyOf(f))) continue;
    if (f.name && nameLocked.has(f.name)) continue;
    out.push(f);
    seen.add(keyOf(f));
  }
  return out;
}
