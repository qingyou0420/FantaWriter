import type {
  Character,
  GenerationSettings,
  Outline,
  OutlineChapter,
  StoryBackground,
  WritingBoard,
} from "./types";
import {
  LENGTH_LABELS,
  PERSON_LABELS,
  STYLE_LABELS,
  mergeTags,
} from "./types";
import { GENERAL_SETTING_SYSTEM } from "./prompts/general";
import { CRAFT_SYSTEM } from "./prompts/craft";

export const SETTING_SYSTEM = GENERAL_SETTING_SYSTEM;

function formatCharacterFull(c: Character, index: number): string {
  const lines = [
    `【人物 ${index + 1}】${c.name || "未命名"}`,
    c.role && `定位：${c.role}`,
    c.gender && `性别：${c.gender}`,
    c.age && `年龄：${c.age}`,
    c.appearance && `外貌：${c.appearance}`,
    c.personality && `性格：${c.personality}`,
    c.background && `背景：${c.background}`,
    c.relationships && `人物关系：${c.relationships}`,
    c.aliases?.length && `别名：${c.aliases.join("、")}`,
    c.speechStyle && `说话风格：${c.speechStyle}`,
    c.notes && `备注：${c.notes}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/** 非出场人物：一行名片（姓名+定位+与出场人物的关系） */
export function formatCharacterNameCard(
  c: Character,
  cast: Character[]
): string {
  const name = (c.name || "未命名").replace(/\s+/g, " ").trim();
  const role = (c.role || "").replace(/\s+/g, " ").trim();
  const castNames = cast.map((x) => x.name).filter(Boolean);
  let rel = (c.relationships || "").replace(/\s+/g, " ").trim();
  if (castNames.length && rel) {
    const hit = castNames.find((n) => rel.includes(n));
    if (hit) {
      const idx = rel.indexOf(hit);
      rel = rel.slice(Math.max(0, idx - 12), idx + 40).trim();
    }
  }
  if (rel.length > 48) rel = `${rel.slice(0, 48)}…`;
  return `- ${name}${role ? `｜${role}` : ""}${rel ? `｜${rel}` : ""}`;
}

export function formatCharacters(
  characters: Character[],
  opts?: { castIds?: string[] }
): string {
  if (!characters.length) return "（暂无人物）";
  const castIds = (opts?.castIds || []).filter(Boolean);
  if (!castIds.length) {
    return characters.map((c, i) => formatCharacterFull(c, i)).join("\n\n");
  }
  const castSet = new Set(castIds);
  const featured = characters.filter((c) => castSet.has(c.id));
  const others = characters.filter((c) => !castSet.has(c.id));
  const featuredBlock = featured.length
    ? featured.map((c, i) => formatCharacterFull(c, i)).join("\n\n")
    : "（未匹配到出场人物，回退为全量）\n" +
      characters.map((c, i) => formatCharacterFull(c, i)).join("\n\n");
  if (!others.length || !featured.length) return featuredBlock;
  const NAME_CARD_CAP = 20;
  const shown = others.slice(0, NAME_CARD_CAP);
  const omitted = others.length - shown.length;
  const cards = shown.map((c) => formatCharacterNameCard(c, featured)).join("\n");
  const footer =
    omitted > 0 ? `\n其余 ${omitted} 人本章不出场，勿写入。` : "";
  return `## 本章出场人物（完整设定）\n${featuredBlock}\n\n## 其余人物（仅名片，非必要勿写入正文）\n${cards}${footer}`;
}

export function formatBackground(bg: StoryBackground): string {
  return [
    bg.title && `故事标题：${bg.title}`,
    bg.synopsis && `故事梗概：${bg.synopsis}`,
    bg.setting && `世界/场景设定：${bg.setting}`,
    bg.era && `时代：${bg.era}`,
    bg.themes && `主题：${bg.themes}`,
    bg.tone && `基调：${bg.tone}`,
    bg.extra && `补充：${bg.extra}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatSettings(
  s: GenerationSettings,
  _writingBoard: WritingBoard = "general"
): string {
  void _writingBoard;
  let styleLine: string;
  if (s.writingStyle === "learned" && s.learnedStyleGuide?.trim()) {
    styleLine = `文笔文风：学习固定风格「${s.learnedStyleName || "未命名"}」（必须严格模仿，见下文风格指南）`;
  } else if (s.writingStyle === "custom") {
    styleLine = `文笔文风：${s.customStyle || "用户自定义"}`;
  } else {
    styleLine = `文笔文风：${STYLE_LABELS[s.writingStyle] || s.writingStyle}`;
  }

  const lines: string[] = [];
  lines.push(
    styleLine,
    `叙述人称：${PERSON_LABELS[s.person]}`,
    `章节篇幅：${
      s.customLength && s.customLength.min < s.customLength.max
        ? `自定义（${s.customLength.min}–${s.customLength.max}字/章）`
        : LENGTH_LABELS[s.length]
    }`,
    `语言：${s.language === "zh" ? "中文" : "English"}`
  );
  if (s.extraInstructions) lines.push(`额外指令：${s.extraInstructions}`);

  if (s.writingStyle === "learned" && s.learnedStyleGuide?.trim()) {
    const exec =
      "执行：句式、用词、节奏、对话尽量贴合上述指南；不要退化成通用网文腔。";
    lines.push(
      "",
      "## 固定学习文风指南（硬性，优先于默认文风习惯）",
      s.learnedStyleGuide.trim(),
      exec
    );
    const prints = (s.learnedStyleFingerprints || [])
      .map((f) => String(f || "").trim())
      .filter(Boolean);
    if (prints.length) {
      lines.push(
        "",
        "## 风格例句（模仿其气质，勿照抄）",
        ...prints.map((f, i) => `${i + 1}. ${f}`)
      );
    }
  }

  return lines.join("\n");
}

export function formatTagBlock(
  projectTags?: string[],
  chapterTags?: string[],
  scope: "outline" | "chapter" = "outline",
  _writingBoard: WritingBoard = "general"
): string {
  void _writingBoard;
  const project = (projectTags || []).filter(Boolean);
  const chapter = (chapterTags || []).filter(Boolean);
  const effective =
    scope === "chapter" ? mergeTags(project, chapter) : project;

  if (!project.length && !chapter.length) return "";
  return `类型标签（可作题材/桥段参考）：${effective.join("、")}`;
}

export function buildOutlineSystemPrompt(): string {
  return `${CRAFT_SYSTEM}`;
}

export function buildChapterSystemPrompt(): string {
  return `${CRAFT_SYSTEM}`;
}

export function extractJsonObject(text: string): string {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  return raw;
}

export function parseOutlineJson(
  text: string,
  opts?: { volumeId?: string; characters?: Character[] }
): Outline {
  const data = JSON.parse(extractJsonObject(text)) as {
    premise?: string;
    endingNote?: string;
    chapters?: Array<{
      order?: number;
      title?: string;
      summary?: string;
      keyPoints?: string;
      eroticNote?: string;
      intensityNote?: string;
      hook?: string;
      cast?: string[];
    }>;
  };

  const roster = opts?.characters || [];
  const chapters: OutlineChapter[] = (data.chapters || []).map((c, i) => {
    const intensityNote = String(c.intensityNote || c.eroticNote || "").trim();
    const names = Array.isArray(c.cast)
      ? c.cast.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
    const castIds = names
      .map((name) => roster.find((ch) => ch.name.trim() === name.trim())?.id)
      .filter((id): id is string => Boolean(id));
    return {
      id: crypto.randomUUID(),
      order: c.order ?? i + 1,
      title: c.title || `第 ${i + 1} 章`,
      summary: c.summary || "",
      keyPoints: c.keyPoints || "",
      intensityNote: intensityNote || undefined,
      tags: [],
      volumeId: opts?.volumeId,
      castIds,
      hook: typeof c.hook === "string" ? c.hook : "",
    };
  });

  return {
    premise: data.premise || "",
    endingNote: data.endingNote || "",
    chapters,
    raw: text,
  };
}

export function contextBlock(
  characters?: Character[],
  background?: StoryBackground
): string {
  const parts: string[] = [];
  if (background && formatBackground(background)) {
    parts.push(`## 已有故事背景\n${formatBackground(background)}`);
  }
  if (characters?.length) {
    parts.push(`## 已有人物（供关系一致性参考）\n${formatCharacters(characters)}`);
  }
  return parts.length ? `\n${parts.join("\n\n")}\n` : "";
}

export function parseCharacterFields(text: string): Omit<Character, "id"> {
  const data = JSON.parse(extractJsonObject(text)) as Partial<Character>;
  return {
    name: String(data.name || ""),
    role: String(data.role || ""),
    gender: String(data.gender || ""),
    age: String(data.age || ""),
    appearance: String(data.appearance || ""),
    personality: String(data.personality || ""),
    background: String(data.background || ""),
    relationships: String(data.relationships || ""),
    notes: String(data.notes || ""),
  };
}

export function parseBackgroundFields(text: string): StoryBackground {
  const data = JSON.parse(extractJsonObject(text)) as Partial<StoryBackground>;
  return {
    title: String(data.title || ""),
    synopsis: String(data.synopsis || ""),
    setting: String(data.setting || ""),
    era: String(data.era || ""),
    themes: String(data.themes || ""),
    tone: String(data.tone || ""),
    extra: String(data.extra || ""),
  };
}

export function parseCastBundle(text: string): {
  background: StoryBackground;
  characters: Omit<Character, "id">[];
} {
  const data = JSON.parse(extractJsonObject(text)) as {
    background?: Partial<StoryBackground>;
    characters?: Partial<Character>[];
  };
  const background = parseBackgroundFields(
    JSON.stringify(data.background || {})
  );
  const characters = (data.characters || []).map((c) => ({
    name: String(c.name || ""),
    role: String(c.role || ""),
    gender: String(c.gender || ""),
    age: String(c.age || ""),
    appearance: String(c.appearance || ""),
    personality: String(c.personality || ""),
    background: String(c.background || ""),
    relationships: String(c.relationships || ""),
    notes: String(c.notes || ""),
  }));
  return { background, characters };
}

export function parseSettingsFields(
  text: string,
  fallback: GenerationSettings
): GenerationSettings {
  const data = JSON.parse(extractJsonObject(text)) as Partial<GenerationSettings> & {
    chapterCount?: number;
  };
  const writingStyle = (
    [
      "literary",
      "plain",
      "poetic",
      "passionate",
      "restrained",
      "dark",
      "humorous",
      "custom",
      "learned",
    ] as const
  ).includes(data.writingStyle as GenerationSettings["writingStyle"])
    ? (data.writingStyle as GenerationSettings["writingStyle"])
    : fallback.writingStyle;
  const keepLearned =
    fallback.writingStyle === "learned" && fallback.learnedStyleGuide;
  const person = (["first", "second", "third"] as const).includes(
    data.person as GenerationSettings["person"]
  )
    ? (data.person as GenerationSettings["person"])
    : fallback.person;
  const length = (["short", "medium", "long"] as const).includes(
    data.length as GenerationSettings["length"]
  )
    ? (data.length as GenerationSettings["length"])
    : fallback.length;
  const language =
    data.language === "en" || data.language === "zh"
      ? data.language
      : fallback.language;
  const chapterCount = Math.max(
    1,
    Math.min(30, Number(data.chapterCount) || fallback.chapterCount)
  );
  return {
    writingStyle: keepLearned ? "learned" : writingStyle,
    customStyle: String(data.customStyle ?? fallback.customStyle),
    learnedStyleId: fallback.learnedStyleId || "",
    learnedStyleGuide: fallback.learnedStyleGuide || "",
    learnedStyleName: fallback.learnedStyleName || "",
    learnedStyleFingerprints: fallback.learnedStyleFingerprints || [],
    person,
    length,
    language,
    chapterCount,
    extraInstructions: String(
      data.extraInstructions ?? fallback.extraInstructions
    ),
    extraRules: fallback.extraRules,
    temperature: fallback.temperature,
  };
}

export function parseLearnedStyleFields(
  text: string
): Omit<
  import("./types").LearnedStyle,
  "id" | "createdAt" | "updatedAt" | "sourceLabel" | "sourceChars"
> {
  const data = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
  const fingerprints = Array.isArray(data.fingerprints)
    ? data.fingerprints.map((x) => String(x)).filter(Boolean)
    : [];
  return {
    name: String(data.name || "未命名文风"),
    writingBoard: "general",
    overall: String(data.overall || ""),
    vocabulary: String(data.vocabulary || ""),
    rhythm: String(data.rhythm || ""),
    narrative: String(data.narrative || ""),
    dialogue: String(data.dialogue || ""),
    extras: String(data.extras || ""),
    sensory: String(data.sensory || ""),
    structure: String(data.structure || ""),
    avoid: String(data.avoid || ""),
    styleGuide: String(data.styleGuide || ""),
    fingerprints,
  };
}

export function parsePolishedChapterOutline(text: string): {
  title: string;
  summary: string;
  keyPoints: string;
  intensityNote: string;
} {
  const data = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
  return {
    title: String(data.title || ""),
    summary: String(data.summary || ""),
    keyPoints: String(data.keyPoints || ""),
    intensityNote: String(data.intensityNote || data.eroticNote || ""),
  };
}

export type RewriteMode =
  | "polish"
  | "expand"
  | "shorten"
  | "dialogue"
  | "custom";

export function buildChapterSummaryUserPrompt(opts: {
  content: string;
  title: string;
  openThreads?: string[];
  serialMode?: boolean;
}): string {
  const threads = (opts.openThreads || []).map((t) => t.trim()).filter(Boolean);
  const threadLine = threads.length
    ? `\n当前未回收伏笔标题：${threads.join("、")}\n请在摘要末尾单独一行写：触及的伏笔：A、B（只列确实写到的；没有则写「触及的伏笔：无」）`
    : `\n若正文触及可回收线索，在摘要末尾单独一行写：触及的伏笔：A、B；没有则写「触及的伏笔：无」`;
  const hookLine = opts.serialMode
    ? `\n4. 本章结尾钩子是否落地，一句话写进摘要散文（不要另起字段）`
    : "";
  return `请用 120–250 字中文总结下列章节正文，供后续章节衔接使用。
必须包含：
1. 关键事件与情节推进
2. 主要人物的状态变化（称呼/情绪/关系/伤势等，写具体）
3. 未解冲突与可回收伏笔${hookLine}
不要引号包裹，不要标题。${threadLine}

在散文摘要之后，另起一段只输出如下 JSON（不要 markdown 代码块）。只写**本章发生变化**的人物、只写正文明写的事实；无人变化则 "states": []：
{"states":[{"name":"姓名","location":"可选","injury":"可选","relationsDelta":"可选","addressDelta":"可选","goal":"可选"}]}

章节：${opts.title}
正文：
${opts.content.slice(0, 8000)}`;
}

export function parseTouchedThreads(text: string): string[] {
  const line =
    text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => /^触及的伏笔[：:]/.test(s)) || "";
  if (!line) return [];
  const raw = line.replace(/^触及的伏笔[：:]\s*/, "").trim();
  if (!raw || raw === "无" || raw === "没有" || raw === "无。") return [];
  return raw
    .split(/[、,，;；]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "无");
}

export function stripTouchedThreadLine(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((s) => !/^\s*触及的伏笔[：:]/.test(s))
    .join("\n")
    .trim();
}

export function buildConsistencyCheckUserPrompt(opts: {
  characters: Character[];
  background: StoryBackground;
  chapters: {
    order: number;
    title: string;
    content?: string;
    summary?: string;
  }[];
}): string {
  const samples = opts.chapters
    .map((c) => {
      const summary = (c.summary || "").replace(/\s+/g, " ").trim();
      const body = (c.content || "").replace(/\s+/g, " ").trim();
      const text = summary || body.slice(0, 1200);
      const source = summary ? "（章摘要）" : "（正文节选）";
      return `### 第${c.order}章 ${c.title} ${source}\n${text || "（无）"}`;
    })
    .join("\n\n");

  return `你是小说连续性审稿人。请检查人物设定与正文是否一致。

## 人物设定
${formatCharacters(opts.characters)}

## 背景
${formatBackground(opts.background)}

## 正文采样（优先章摘要，无摘要才截正文）
${samples}

## 输出 JSON（不要 markdown）
{
  "score": 1到10的整数,
  "summary": "总体评价一句话",
  "issues": [
    {
      "severity": "high/medium/low 之一",
      "detail": "具体矛盾说明",
      "suggestion": "修改建议",
      "character": "可选：相关人物名",
      "chapter": "可选：章节标题"
    }
  ]
}
若无明显问题，issues 可为 []。只关注：外貌/年龄/称呼/关系/性格/已发生事实前后矛盾。`;
}

export function parseConsistencyResult(text: string): {
  score: number;
  summary: string;
  issues: {
    severity: string;
    detail: string;
    suggestion: string;
    character?: string;
    chapter?: string;
  }[];
} {
  const data = JSON.parse(extractJsonObject(text)) as {
    score?: number;
    summary?: string;
    issues?: Array<Record<string, unknown>>;
  };
  return {
    score: Number(data.score) || 0,
    summary: String(data.summary || ""),
    issues: (data.issues || []).map((i) => {
      const severityRaw = String(i.severity || "").trim();
      const looksLikeLevel = /^(high|medium|low|高|中|低)$/i.test(severityRaw);
      const character =
        i.character != null && String(i.character).trim()
          ? String(i.character)
          : !looksLikeLevel &&
              severityRaw &&
              !/high|medium|low|问题|矛盾/.test(severityRaw.toLowerCase())
            ? severityRaw
            : undefined;
      return {
        severity: looksLikeLevel ? severityRaw.toLowerCase() : severityRaw,
        detail: String(i.detail || ""),
        suggestion: String(i.suggestion || ""),
        character,
        chapter: i.chapter ? String(i.chapter) : undefined,
      };
    }),
  };
}

export function buildOutlineVsContentUserPrompt(opts: {
  chapter: OutlineChapter;
  content: string;
  projectTags?: string[];
}): string {
  const tags = mergeTags(opts.projectTags, opts.chapter.tags);
  return `对照「章节大纲」与「正文」，检查落实情况。

## 大纲
标题：${opts.chapter.title}
摘要：${opts.chapter.summary}
关键点：${opts.chapter.keyPoints}
节奏备注：${opts.chapter.intensityNote || opts.chapter.eroticNote || "无"}
标签：${tags.length ? tags.join("、") : "无"}

## 正文
${opts.content.slice(0, 10000)}

## 输出 JSON（不要 markdown）
{
  "covered": ["已落实的大纲要点"],
  "missing": ["正文未体现的大纲/标签要点"],
  "extra": ["正文有但大纲未写的重要偏离"],
  "score": 1到10,
  "advice": "如何补写的简短建议"
}`;
}

export function parseOutlineCheckResult(text: string): {
  covered: string[];
  missing: string[];
  extra: string[];
  score: number;
  advice: string;
} {
  const data = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x)) : [];
  return {
    covered: arr(data.covered),
    missing: arr(data.missing),
    extra: arr(data.extra),
    score: Number(data.score) || 0,
    advice: String(data.advice || ""),
  };
}

export function parseScenePlan(text: string): {
  order: number;
  title: string;
  summary: string;
  verbatimAnchors?: string[];
}[] {
  const data = JSON.parse(extractJsonObject(text)) as {
    scenes?: Array<Record<string, unknown>>;
  };
  return (data.scenes || []).map((s, i) => {
    const anchors = Array.isArray(s.verbatimAnchors)
      ? s.verbatimAnchors.map((a) => String(a).trim()).filter(Boolean)
      : [];
    return {
      order: Number(s.order) || i + 1,
      title: String(s.title || `场景${i + 1}`),
      summary: String(s.summary || ""),
      verbatimAnchors: anchors.length ? anchors : undefined,
    };
  });
}

/** 选区前后各 windowChars 字的滑窗，供润色看见远处上下文 */
export function sliceAroundSelection(
  full: string,
  start: number,
  end: number,
  windowChars = 2000
): string {
  const from = Math.max(0, Math.min(start, end) - windowChars);
  const to = Math.min(full.length, Math.max(start, end) + windowChars);
  return full.slice(from, to);
}
