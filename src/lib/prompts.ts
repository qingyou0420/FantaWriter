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
export const ADULT_SYSTEM = CRAFT_SYSTEM;

export function formatCharacters(characters: Character[]): string {
  if (!characters.length) return "（暂无人物）";
  return characters
    .map((c, i) => {
      const lines = [
        `【人物 ${i + 1}】${c.name || "未命名"}`,
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
    })
    .join("\n\n");
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
    `章节篇幅：${LENGTH_LABELS[s.length]}`,
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
  }

  return lines.join("\n");
}

export function formatTagBlock(
  projectTags?: string[],
  chapterTags?: string[],
  scope: "outline" | "chapter" = "outline",
  _writingBoard: WritingBoard = "general"
): string {
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

export function buildOutlineUserPrompt(
  characters: Character[],
  background: StoryBackground,
  settings: GenerationSettings,
  projectTags?: string[]
): string {
  return `请根据以下设定，生成一份可编辑的小说大纲。

## 人物设定
${formatCharacters(characters)}

## 故事背景
${formatBackground(background)}

## 生成参数
${formatSettings(settings, "general")}
建议章节数：约 ${settings.chapterCount} 章（可按故事需要 ±2）
${formatTagBlock(projectTags, undefined, "outline", "general") ? `\n## 类型标签\n${formatTagBlock(projectTags, undefined, "outline", "general")}\n` : ""}
## 输出要求
请严格输出如下 JSON（不要 markdown 代码块，不要其它说明文字）：
{
  "premise": "一句话故事前提",
  "endingNote": "结局走向简述",
  "chapters": [
    {
      "order": 1,
      "title": "章节标题",
      "summary": "本章剧情摘要（3–6句）",
      "keyPoints": "关键情节点/冲突/转折，分号分隔",
      "intensityNote": "可选：节奏/冲突/情绪强度备注；无则空字符串"
    }
  ]
}`;
}

export function buildChapterSystemPrompt(): string {
  return `${CRAFT_SYSTEM}`;
}

export function buildChapterUserPrompt(
  characters: Character[],
  background: StoryBackground,
  settings: GenerationSettings,
  outline: Outline,
  chapter: OutlineChapter,
  previousChapterSnippet?: string,
  projectTags?: string[]
): string {
  const allChapters = outline.chapters
    .map(
      (c) =>
        `${c.order}. 《${c.title}》— ${c.summary}${(c.intensityNote || c.eroticNote) && (c.intensityNote || c.eroticNote) !== "无" ? ` [节奏：${c.intensityNote || c.eroticNote}]` : ""}${(c.tags || []).length ? ` [章标签：${(c.tags || []).join("、")}]` : ""}`
    )
    .join("\n");

  return `请根据完整大纲，撰写**其中一章**的详细正文。

## 人物设定
${formatCharacters(characters)}

## 故事背景
${formatBackground(background)}

## 写作参数
${formatSettings(settings)}

## 类型标签
${formatTagBlock(projectTags, chapter.tags, "chapter", "general")}

## 整体前提
${outline.premise}
结局走向：${outline.endingNote}

## 全书大纲（供连贯性参考）
${allChapters}

## 当前要写的章节
章节序号：${chapter.order}
标题：${chapter.title}
摘要：${chapter.summary}
关键点：${chapter.keyPoints}
节奏备注：${chapter.intensityNote || chapter.eroticNote || "无"}
本章标签：${(chapter.tags || []).length ? chapter.tags.join("、") : "无"}

${previousChapterSnippet ? `## 上一章结尾片段（衔接用）\n${previousChapterSnippet}\n` : ""}
## 正文要求
1. 只写本章正文，不要写「第X章」以外的元说明。
2. 开头可保留一行标题：# ${chapter.title}
3. 严格按文风与人称；人物口吻与设定一致。
4. 情节完整、有起承转合，与前后章可衔接。
5. 直接输出小说正文。`;
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

export function parseOutlineJson(text: string): Outline {
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
    }>;
  };

  const chapters: OutlineChapter[] = (data.chapters || []).map((c, i) => {
    const intensityNote = c.intensityNote || "";
    const eroticNote = c.eroticNote || intensityNote || "";
    return {
      id: crypto.randomUUID(),
      order: c.order ?? i + 1,
      title: c.title || `第 ${i + 1} 章`,
      summary: c.summary || "",
      keyPoints: c.keyPoints || "",
      eroticNote,
      intensityNote: intensityNote || eroticNote || undefined,
      tags: [],
    };
  });

  return {
    premise: data.premise || "",
    endingNote: data.endingNote || "",
    chapters,
    raw: text,
  };
}

export function buildSettingSystemPrompt(): string {
  return SETTING_SYSTEM;
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

export function buildExpandCharacterUserPrompt(opts: {
  seed: string;
  character?: Character;
  otherCharacters?: Character[];
  background?: StoryBackground;
  instruction?: string;
}): string {
  const current = opts.character
    ? `\n## 当前草稿（可覆盖/补全）\n${formatCharacters([opts.character])}\n`
    : "";
  return `请根据用户的简短描述，扩写成**一个**完整人物设定。
${contextBlock(opts.otherCharacters, opts.background)}${current}
## 用户输入
${opts.seed || "（用户未写灵感，请基于已有草稿深化）"}
${opts.instruction ? `\n## 额外要求\n${opts.instruction}\n` : ""}
## 输出 JSON（字段均用字符串）
{
  "name": "姓名",
  "role": "主角/配角/对手等",
  "gender": "性别",
  "age": "成年年龄，如 28",
  "appearance": "外貌与气质，80–150字，具体可感",
  "personality": "性格、说话方式、情绪模式，80–150字",
  "background": "出身、职业、重要过往，80–150字",
  "relationships": "与故事中他人的关系与张力",
  "notes": "口癖、癖好倾向、写作注意点"
}`;
}

export function buildOptimizeCharacterUserPrompt(opts: {
  character: Character;
  otherCharacters?: Character[];
  background?: StoryBackground;
  instruction?: string;
}): string {
  return `请优化并扩写以下人物设定：补全空白、理顺逻辑、增加可写细节，保留用户已写的核心设定与姓名（除非明显空白需命名）。
${contextBlock(opts.otherCharacters, opts.background)}
## 待优化人物
${formatCharacters([opts.character])}
${opts.instruction ? `\n## 额外要求\n${opts.instruction}\n` : ""}
## 输出 JSON（字段均用字符串，全面填满）
{
  "name": "",
  "role": "",
  "gender": "",
  "age": "",
  "appearance": "",
  "personality": "",
  "background": "",
  "relationships": "",
  "notes": ""
}`;
}

export function buildExpandBackgroundUserPrompt(opts: {
  seed: string;
  background?: StoryBackground;
  characters?: Character[];
  instruction?: string;
}): string {
  const current = opts.background && formatBackground(opts.background)
    ? `\n## 当前草稿\n${formatBackground(opts.background)}\n`
    : "";
  return `请根据用户的简短描述，扩写成完整**故事背景**设定。
${contextBlock(opts.characters)}${current}
## 用户输入
${opts.seed || "（用户未写灵感，请基于已有草稿深化）"}
${opts.instruction ? `\n## 额外要求\n${opts.instruction}\n` : ""}
## 输出 JSON
{
  "title": "有吸引力的故事标题",
  "synopsis": "故事梗概 150–300 字：主线、冲突、情感/欲望走向",
  "setting": "世界与主要场景，具体地点与氛围",
  "era": "时代，如现代/民国/架空",
  "themes": "主题关键词，顿号分隔",
  "tone": "基调，如暧昧、禁忌、甜虐、黑暗",
  "extra": "补充：禁忌边界、必写桥段、不要写什么"
}`;
}

export function buildOptimizeBackgroundUserPrompt(opts: {
  background: StoryBackground;
  characters?: Character[];
  instruction?: string;
}): string {
  return `请优化并扩写以下故事背景：补全空白、增强冲突与氛围，保留用户核心意图。
${contextBlock(opts.characters)}
## 待优化背景
${formatBackground(opts.background)}
${opts.instruction ? `\n## 额外要求\n${opts.instruction}\n` : ""}
## 输出 JSON
{
  "title": "",
  "synopsis": "",
  "setting": "",
  "era": "",
  "themes": "",
  "tone": "",
  "extra": ""
}`;
}

export function buildExpandCastUserPrompt(opts: {
  seed: string;
  characterCount?: number;
  instruction?: string;
}): string {
  const n = Math.min(8, Math.max(1, opts.characterCount ?? 2));
  return `用户只用一句话/一小段描述了故事灵感。请一次性生成：故事背景 + ${n} 个核心人物设定（均为成年人）。
人物之间要有关系与张力，服务于类型/文学向虚构小说。

## 用户灵感
${opts.seed}
${opts.instruction ? `\n## 额外要求\n${opts.instruction}\n` : ""}
## 输出 JSON
{
  "background": {
    "title": "",
    "synopsis": "",
    "setting": "",
    "era": "",
    "themes": "",
    "tone": "",
    "extra": ""
  },
  "characters": [
    {
      "name": "",
      "role": "主角",
      "gender": "",
      "age": "",
      "appearance": "",
      "personality": "",
      "background": "",
      "relationships": "",
      "notes": ""
    }
  ]
}
characters 数组长度必须为 ${n}。`;
}

export function buildOptimizeSettingsUserPrompt(opts: {
  settings: GenerationSettings;
  characters?: Character[];
  background?: StoryBackground;
  instruction?: string;
}): string {
  return `根据已有人物与故事背景，优化「生成参数」中的文风建议与额外写作指令，使后续大纲/正文更贴合故事。
${contextBlock(opts.characters, opts.background)}
## 当前参数
${formatSettings(opts.settings)}
${opts.instruction ? `\n## 用户要求\n${opts.instruction}\n` : ""}
## 输出 JSON
{
  "writingStyle": "literary|plain|poetic|dark|humorous|custom 之一",
  "customStyle": "若 writingStyle 为 custom 则填写文风描述，否则空字符串",
  "person": "first|second|third 之一",
  "length": "short|medium|long 之一",
  "language": "zh|en 之一",
  "chapterCount": 3到12的整数,
  "extraInstructions": "具体可执行的额外写作指令，80–200字"
}`;
}

export function parseCharacterFields(
  text: string
): Omit<Character, "id"> {
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
    eroticLevel?: number;
    chapterCount?: number;
  };
  const level = Number(data.eroticLevel);
  const eroticLevel = ([1, 2, 3, 4, 5].includes(level)
    ? level
    : fallback.eroticLevel) as GenerationSettings["eroticLevel"];
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
  // 优化参数时不要冲掉已绑定的学习文风
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
    eroticLevel,
    writingStyle: keepLearned ? "learned" : writingStyle,
    customStyle: String(data.customStyle ?? fallback.customStyle),
    learnedStyleId: fallback.learnedStyleId || "",
    learnedStyleGuide: fallback.learnedStyleGuide || "",
    learnedStyleName: fallback.learnedStyleName || "",
    person,
    length,
    language,
    chapterCount,
    extraInstructions: String(
      data.extraInstructions ?? fallback.extraInstructions
    ),
  };
}

export function buildLearnStyleUserPrompt(opts: {
  sampleText: string;
  nameHint?: string;
}): string {
  return `你是资深文学风格分析师。请阅读用户导入的小说范文（可能是头/中/尾采样），提炼可复用的**固定写作风格档案**，用于之后让 AI 用同一文风写新故事。

要求：
1. 分析文风、文笔、写法（句式节奏、用词、叙事、对话、感官、结构习惯）。
2. 输出要具体、可执行，避免空泛形容词堆砌。
3. styleGuide 必须是一份完整的「写作守则」，可直接当作 system 风格指令使用（300–600 字）。
4. fingerprints 给出 3–5 句「像范文」的短句模板（可改写自原文气质，勿大段照抄）。
5. 只输出 JSON，不要 markdown 代码块。

## 风格名称提示
${opts.nameHint || "（未命名，请起一个简短风格名）"}

## 范文采样
${opts.sampleText}

## 输出 JSON
{
  "name": "简短风格名，如：冷感短句都市体",
  "overall": "整体气质与调性",
  "vocabulary": "用词习惯、语域、修辞偏好",
  "rhythm": "句式长短、节奏、标点习惯",
  "narrative": "视角推进、时间线、信息释放方式",
  "dialogue": "对话密度与口吻",
  "sensory": "感官侧重（视觉/触觉/气味等）",
  "structure": "段落与场面组织方式",
  "avoid": "应避免的写法（与范文气质冲突的）",
  "styleGuide": "合并后的固定风格写作指南（完整段落）",
  "fingerprints": ["指纹句1", "指纹句2", "指纹句3"]
}`;
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
    extras: String(data.extras || data.erotic || ""),
    sensory: String(data.sensory || ""),
    structure: String(data.structure || ""),
    avoid: String(data.avoid || ""),
    styleGuide: String(data.styleGuide || ""),
    fingerprints,
  };
}

/** 按标签润色单章大纲 */
export function buildPolishChapterOutlineUserPrompt(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  outline: Outline;
  chapter: OutlineChapter;
  projectTags?: string[];
}): string {
  const bookTags = opts.projectTags || [];
  const chTags = opts.chapter.tags || [];
  const all = mergeTags(bookTags, chTags);
  const others = opts.outline.chapters
    .filter((c) => c.id !== opts.chapter.id)
    .sort((a, b) => a.order - b.order)
    .map(
      (c) =>
        `${c.order}. 《${c.title}》— ${c.summary}${(c.tags || []).length ? ` [标签:${(c.tags || []).join("、")}]` : ""}`
    )
    .join("\n");

  return `请根据行为标签，润色**单章大纲**（只改本章，保持与全书连贯）。

## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings)}

## 全书前提
${opts.outline.premise}
结局：${opts.outline.endingNote}

## 其它章节（勿改，仅供连贯）
${others || "（无）"}

## 当前章节（待润色）
序号：${opts.chapter.order}
标题：${opts.chapter.title}
摘要：${opts.chapter.summary}
关键点：${opts.chapter.keyPoints}
节奏备注：${opts.chapter.intensityNote || opts.chapter.eroticNote || ""}
本章标签：${chTags.length ? chTags.join("、") : "无"}
全书标签：${bookTags.length ? bookTags.join("、") : "无"}

## 硬性要求
1. 把类型标签对应的题材/桥段规划进本章摘要与关键点。
2. intensityNote 写明本章节奏与冲突强度。
3. 保持人物性格与前后章可衔接，不推翻全书前提。
4. 输出更具体、可写正文的大纲，不要空话。

## 输出 JSON（不要 markdown）
{
  "title": "润色后的章节标题",
  "summary": "3–8句剧情摘要",
  "keyPoints": "关键点，分号分隔",
  "intensityNote": "节奏/冲突/情绪强度备注"
}`;
}

export function parsePolishedChapterOutline(text: string): {
  title: string;
  summary: string;
  keyPoints: string;
  eroticNote: string;
} {
  const data = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
  return {
    title: String(data.title || ""),
    summary: String(data.summary || ""),
    keyPoints: String(data.keyPoints || ""),
    eroticNote: String(data.intensityNote || data.eroticNote || ""),
  };
}

export type RewriteMode =
  | "polish"
  | "expand"
  | "shorten"
  | "dialogue"
  | "custom";

const REWRITE_LABELS: Record<RewriteMode, string> = {
  polish: "润色文笔（保持情节与信息不变）",
  expand: "扩写细节与氛围（加长但不跑题）",
  shorten: "精简压缩（保留关键信息）",
  dialogue: "强化对话自然度与人物口吻",
  custom: "按用户自定义指令改写",
};

export function buildRewriteUserPrompt(opts: {
  mode: RewriteMode;
  selectedText: string;
  fullContext?: string;
  instruction?: string;
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
}): string {
  return `请对下列小说正文片段进行改写。

## 改写目标
${REWRITE_LABELS[opts.mode]}
${opts.instruction ? `用户补充指令：${opts.instruction}` : ""}

## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings)}

${opts.fullContext ? `## 所在章节上下文（供连贯，勿重复输出全文）\n${opts.fullContext.slice(0, 2500)}\n` : ""}
## 待改写片段
${opts.selectedText}

## 输出要求
1. 只输出改写后的正文片段，不要解释。
2. 保持人称、时态与前后可衔接。
3. 保持人物口吻与既定设定一致。`;
}

export function buildContinueUserPrompt(opts: {
  existingText: string;
  instruction?: string;
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  writingBoard?: WritingBoard;
  chapter?: OutlineChapter;
  outlineContext?: string;
  previousSummary?: string;
  plotThreads?: string;
  characterStateCard?: string;
  lore?: string;
}): string {
  return `请从给定正文**末尾自然续写**，不要重复已有内容。

## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings, "general")}

${opts.characterStateCard ? `## 角色状态卡\n${opts.characterStateCard}\n` : ""}
${opts.chapter ? `## 本章目标\n标题：${opts.chapter.title}\n摘要：${opts.chapter.summary}\n关键点：${opts.chapter.keyPoints}\n` : ""}
${opts.outlineContext ? `## 大纲参考\n${opts.outlineContext}\n` : ""}
${opts.previousSummary ? `## 前情摘要\n${opts.previousSummary}\n` : ""}
${opts.plotThreads ? `## 伏笔线索（可推进，勿无故遗忘）\n${opts.plotThreads}\n` : ""}
${opts.lore ? `## 世界观设定（关键词命中）\n${opts.lore}\n` : ""}
${opts.instruction ? `## 续写方向\n${opts.instruction}\n` : ""}
## 已有正文（请接在其后）
${opts.existingText.slice(-6000)}

## 输出要求
1. 只输出续写部分，不要重复上文。
2. 保持文风、人称、尺度一致，情节连贯；称呼与人物状态勿漂移。
3. 续写约 400–1200 字（除非用户另有要求）。`;
}

export function buildChapterSummaryUserPrompt(content: string, title: string): string {
  return `请用 120–250 字中文总结下列章节正文，供后续章节衔接使用。
必须包含：
1. 关键事件与情节推进
2. 主要人物的状态变化（称呼/情绪/关系/伤势等，写具体）
3. 未解冲突与可回收伏笔
不要引号包裹，不要标题。

章节：${title}
正文：
${content.slice(0, 8000)}`;
}

export function buildConsistencyCheckUserPrompt(opts: {
  characters: Character[];
  background: StoryBackground;
  chapters: { order: number; title: string; content: string }[];
}): string {
  const samples = opts.chapters
    .map((c) => {
      const body = c.content.replace(/\s+/g, " ").slice(0, 1200);
      return `### 第${c.order}章 ${c.title}\n${body}`;
    })
    .join("\n\n");

  return `你是小说连续性审稿人。请检查人物设定与正文是否一致。

## 人物设定
${formatCharacters(opts.characters)}

## 背景
${formatBackground(opts.background)}

## 正文采样
${samples}

## 输出 JSON（不要 markdown）
{
  "score": 1到10的整数,
  "summary": "总体评价一句话",
  "issues": [
    {
      "severity": "问题简述",
      "detail": "具体矛盾说明",
      "suggestion": "修改建议",
      "severity": "可选：相关人物名",
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
    issues: (data.issues || []).map((i) => ({
      severity: String(i.severity || ""),
      detail: String(i.detail || ""),
      suggestion: String(i.suggestion || ""),
      character: i.character ? String(i.character) : undefined,
      chapter: i.chapter ? String(i.chapter) : undefined,
    })),
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

export function buildScenePlanUserPrompt(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  chapter: OutlineChapter;
  projectTags?: string[];
  writingBoard?: WritingBoard;
}): string {
  const board: WritingBoard = "general";
  const intensity = `节奏：${opts.chapter.intensityNote || opts.chapter.eroticNote || "无"}`;
  return `把本章拆成 3–6 个可连续写作的场景，便于分场景生成正文。

## 人物
${formatCharacters(opts.characters)}

## 背景
${formatBackground(opts.background)}

## 参数
${formatSettings(opts.settings, board)}

## 本章大纲
标题：${opts.chapter.title}
摘要：${opts.chapter.summary}
关键点：${opts.chapter.keyPoints}
${intensity}
标签：${mergeTags(opts.projectTags, opts.chapter.tags).join("、") || "无"}

## 输出 JSON
{
  "scenes": [
    { "order": 1, "title": "场景名", "summary": "本场景要写什么（2-4句）" }
  ]
}`;
}

export function parseScenePlan(text: string): {
  order: number;
  title: string;
  summary: string;
}[] {
  const data = JSON.parse(extractJsonObject(text)) as {
    scenes?: Array<Record<string, unknown>>;
  };
  return (data.scenes || []).map((s, i) => ({
    order: Number(s.order) || i + 1,
    title: String(s.title || `场景${i + 1}`),
    summary: String(s.summary || ""),
  }));
}

export function buildSceneChapterUserPrompt(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  chapter: OutlineChapter;
  scene: { order: number; title: string; summary: string };
  previousScenesText?: string;
  previousChapterSnippet?: string;
  projectTags?: string[];
  plotThreads?: string;
  lore?: string;
  writingBoard?: WritingBoard;
}): string {
  return `撰写本章中的**一个场景**正文（不是整章）。

## 人物
${formatCharacters(opts.characters)}

## 背景
${formatBackground(opts.background)}

## 参数
${formatSettings(opts.settings, "general")}

## 本章
${opts.chapter.order}. ${opts.chapter.title}
${opts.chapter.summary}
标签：${mergeTags(opts.projectTags, opts.chapter.tags).join("、") || "无"}

## 当前场景 ${opts.scene.order}
标题：${opts.scene.title}
摘要：${opts.scene.summary}

${opts.previousScenesText ? `## 本章已写场景（衔接）\n${opts.previousScenesText.slice(-2000)}\n` : ""}
${opts.previousChapterSnippet ? `## 上章结尾\n${opts.previousChapterSnippet}\n` : ""}
${opts.plotThreads ? `## 伏笔\n${opts.plotThreads}\n` : ""}
${opts.lore ? `## 世界观设定（关键词命中）\n${opts.lore}\n` : ""}
## 要求
1. 只写本场景，约 400–1500 字。
2. 不要写「场景X」元标题；可自然过渡。
3. 直接输出正文。`;
}

/** 增强章生成：附带角色状态卡、前情摘要、伏笔与命中设定 */
export function buildPriorContextBlock(opts: {
  previousSummaries?: string;
  previousSnippet?: string;
  plotThreads?: string;
  characterStateCard?: string;
  lore?: string;
  /** 若已有完整记忆块则优先使用 */
  priorBlock?: string;
}): string {
  if (opts.priorBlock?.trim()) return opts.priorBlock.trim();
  const parts: string[] = [];
  if (opts.characterStateCard) {
    parts.push(`## 角色状态卡\n${opts.characterStateCard}`);
  }
  if (opts.previousSummaries) {
    parts.push(`## 前情摘要（前几章）\n${opts.previousSummaries}`);
  }
  if (opts.previousSnippet) {
    parts.push(`## 上一章结尾片段（衔接用）\n${opts.previousSnippet}`);
  }
  if (opts.plotThreads) {
    parts.push(`## 伏笔/线索（本章可推进或回收）\n${opts.plotThreads}`);
  }
  if (opts.lore) {
    parts.push(`## 世界观设定（关键词命中）\n${opts.lore}`);
  }
  return parts.join("\n\n");
}
