/**
 * story/story_card.md — 问心产出。Runtime presentation only; not a G1 gate.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const STORY_CARD_FILE = "story_card.md";
export const STORY_CARD_SYNOPSIS_MAX = 300;

export interface StoryCardDraft {
  readonly workingTitle: string;
  readonly oneLine: string;
  readonly synopsis: string;
  readonly genre?: string;
  readonly tone?: string;
}

export const EMPTY_STORY_CARD: StoryCardDraft = {
  workingTitle: "",
  oneLine: "",
  synopsis: "",
};

export function trimStoryCard(card: StoryCardDraft): StoryCardDraft {
  const synopsis = card.synopsis.trim().slice(0, STORY_CARD_SYNOPSIS_MAX);
  return {
    workingTitle: card.workingTitle.trim(),
    oneLine: card.oneLine.trim(),
    synopsis,
    ...(card.genre?.trim() ? { genre: card.genre.trim() } : {}),
    ...(card.tone?.trim() ? { tone: card.tone.trim() } : {}),
  };
}

export function storyCardReady(card: StoryCardDraft): boolean {
  const next = trimStoryCard(card);
  return Boolean(next.workingTitle && next.oneLine && next.synopsis);
}

export function mergeStoryCard(
  base: StoryCardDraft,
  patch: Partial<StoryCardDraft> | null | undefined,
): StoryCardDraft {
  if (!patch) return trimStoryCard(base);
  return trimStoryCard({
    workingTitle: patch.workingTitle ?? base.workingTitle,
    oneLine: patch.oneLine ?? base.oneLine,
    synopsis: patch.synopsis ?? base.synopsis,
    genre: patch.genre ?? base.genre,
    tone: patch.tone ?? base.tone,
  });
}

function yamlEscape(value: string): string {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return '""';
  if (/[:#\n"'\\]/.test(trimmed) || trimmed.includes(" ")) {
    return JSON.stringify(trimmed);
  }
  return trimmed;
}

function parseFrontmatter(markdown: string): { readonly fields: Record<string, string>; readonly body: string } {
  const trimmed = markdown.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) return { fields: {}, body: trimmed };
  const close = trimmed.indexOf("\n---", 3);
  if (close < 0) return { fields: {}, body: trimmed };
  const raw = trimmed.slice(4, close);
  const body = trimmed.slice(close + 4).replace(/^\s*\n/, "");
  const fields: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      try {
        value = JSON.parse(value.startsWith("'") ? `"${value.slice(1, -1)}"` : value) as string;
      } catch {
        value = value.slice(1, -1);
      }
    }
    fields[match[1]!] = value;
  }
  return { fields, body };
}

export function parseStoryCard(markdown: string): StoryCardDraft {
  const { fields, body } = parseFrontmatter(markdown);
  const workingTitle = fields.working_title ?? fields.title ?? "";
  const oneLine = fields.one_line ?? fields.oneLine ?? "";
  const synopsis = fields.synopsis ?? body.trim();
  return trimStoryCard({
    workingTitle,
    oneLine,
    synopsis,
    genre: fields.genre,
    tone: fields.tone,
  });
}

export function serializeStoryCard(card: StoryCardDraft): string {
  const next = trimStoryCard(card);
  const lines = [
    "---",
    `working_title: ${yamlEscape(next.workingTitle)}`,
    `one_line: ${yamlEscape(next.oneLine)}`,
    `synopsis: ${yamlEscape(next.synopsis)}`,
  ];
  if (next.genre) lines.push(`genre: ${yamlEscape(next.genre)}`);
  if (next.tone) lines.push(`tone: ${yamlEscape(next.tone)}`);
  lines.push("---", "");
  if (next.synopsis) lines.push(next.synopsis, "");
  return lines.join("\n");
}

export function authorIntentFromStoryCard(card: StoryCardDraft, language: "zh" | "en" = "zh"): string {
  const next = trimStoryCard(card);
  if (language === "en") {
    return [
      next.workingTitle ? `Working title: ${next.workingTitle}` : "",
      next.oneLine,
      next.synopsis,
    ].filter(Boolean).join("\n\n") + "\n";
  }
  return [
    next.workingTitle ? `暂定书名：${next.workingTitle}` : "",
    next.oneLine,
    next.synopsis,
  ].filter(Boolean).join("\n\n") + "\n";
}

export interface ProposedCreateBookFields {
  readonly title?: string;
  readonly genre?: string;
  readonly oneLine?: string;
  readonly synopsis?: string;
  readonly tone?: string;
}

export function extractStoryCardDraft(input: {
  readonly messages?: ReadonlyArray<{ readonly role?: string; readonly content?: string }>;
  readonly proposed?: ProposedCreateBookFields | null;
  readonly local?: Partial<StoryCardDraft> | null;
}): StoryCardDraft {
  let draft = EMPTY_STORY_CARD;
  const texts = (input.messages ?? [])
    .map((message) => String(message.content ?? "").trim())
    .filter(Boolean);
  const blob = texts.join("\n");
  const titleMatch = blob.match(/(?:暂定书名|书名|working title|title)\s*[：:]\s*[《"]?([^\n《》"]{1,40})/i);
  const oneLineMatch = blob.match(/(?:一句话故事|一句话|one[- ]?line)\s*[：:]\s*([^\n]{2,80})/i);
  const synopsisMatch = blob.match(/(?:初步梗概|梗概|synopsis)\s*[：:]\s*([^\n]{2,300})/i);
  const bookTitle = blob.match(/《([^》]{1,40})》/);
  if (titleMatch?.[1] || bookTitle?.[1]) {
    draft = { ...draft, workingTitle: (titleMatch?.[1] ?? bookTitle?.[1] ?? "").trim() };
  }
  if (oneLineMatch?.[1]) draft = { ...draft, oneLine: oneLineMatch[1].trim() };
  if (synopsisMatch?.[1]) draft = { ...draft, synopsis: synopsisMatch[1].trim() };
  if (!draft.synopsis) {
    const userText = (input.messages ?? [])
      .filter((message) => message.role === "user")
      .map((message) => String(message.content ?? "").trim())
      .filter((text) => text.length >= 8)
      .at(-1);
    if (userText) draft = { ...draft, synopsis: userText.slice(0, STORY_CARD_SYNOPSIS_MAX) };
  }
  if (input.proposed) {
    draft = mergeStoryCard(draft, {
      workingTitle: input.proposed.title,
      oneLine: input.proposed.oneLine,
      synopsis: input.proposed.synopsis,
      genre: input.proposed.genre,
      tone: input.proposed.tone,
    });
  }
  return mergeStoryCard(draft, input.local);
}

export function createBookInstruction(card: StoryCardDraft, isZh: boolean): string {
  const next = trimStoryCard(card);
  if (isZh) {
    return [
      `就此建书。`,
      `书名：${next.workingTitle}`,
      `一句话：${next.oneLine}`,
      `梗概：${next.synopsis}`,
      next.genre ? `题材：${next.genre}` : "",
      next.tone ? `基调：${next.tone}` : "",
    ].filter(Boolean).join("\n");
  }
  return [
    `Create this book.`,
    `Title: ${next.workingTitle}`,
    `One-liner: ${next.oneLine}`,
    `Synopsis: ${next.synopsis}`,
    next.genre ? `Genre: ${next.genre}` : "",
    next.tone ? `Tone: ${next.tone}` : "",
  ].filter(Boolean).join("\n");
}

export const REOPEN_ASK_PROMPT = {
  zh: "我想重新推敲这本书的前提",
  en: "I want to rethink this book's premise",
} as const;
