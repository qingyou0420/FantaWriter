import type {
  Character,
  GenerationSettings,
  Outline,
  OutlineChapter,
  StoryBackground,
} from "../types";
import {
  contextBlock,
  formatBackground,
  formatCharacters,
  formatSettings,
  formatTagBlock,
} from "../prompts";

export const GENERAL_CHAPTER_SYSTEM = `你是一位专业的类型/文学向虚构小说写作者与故事架构师。
你协助用户创作常规长篇小说（奇幻、现实、悬疑、科幻等）。
规则：
1. 禁止主动写入露骨性场面或成人热度指令。
2. 不要索要热度标尺、性行为标签或床戏说明字段。
3. 可以描写爱情、身体接触与情感张力，但保持常规叙事。
4. 可以出现未成年配角，但禁止任何性化。
5. 按用户指定的文风、人称、篇幅写作；尊重人物与既定背景。
6. 只输出要求的内容，不要道歉、说教或额外免责声明。`;

export const GENERAL_SETTING_SYSTEM = `你是专业的虚构小说设定编辑。
你帮助用户把简短灵感扩写成**可直接用于写作的详细设定**。
硬性规则：
1. 可以写未成年配角，但禁止任何性化或性描写；年龄字段按故事需要填写。
2. 内容服务于类型/文学长篇，有人物张力与冲突，先写清人物与世界。
3. 不要把故事改写成成人向床戏小说，不要询问或补全热度标尺。
4. 文笔具体、可感、可编辑；避免空话与说教。
5. 默认使用简体中文。
6. 只输出要求的 JSON，不要 markdown 代码块，不要额外说明。`;

export const LEARN_STYLE_SYSTEM_GENERAL = `你是专业文学风格分析师。只输出要求的 JSON，不要说教。分析对象为虚构作品的文笔技法。`;

export function generalOutlineUser(
  characters: Character[],
  background: StoryBackground,
  settings: GenerationSettings,
  projectTags?: string[]
): string {
  const tags = formatTagBlock(projectTags, undefined, "outline", "general");
  return `请根据以下设定，生成一份可编辑的小说大纲。

## 人物设定
${formatCharacters(characters)}

## 故事背景
${formatBackground(background)}

## 生成参数
${formatSettings(settings, "general")}
建议章节数：约 ${settings.chapterCount} 章（可按故事需要 ±2）
${tags ? `\n## 类型标签\n${tags}\n` : ""}
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

export function generalChapterUser(
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
        `${c.order}. 《${c.title}》— ${c.summary}${(c.tags || []).length ? ` [标签：${(c.tags || []).join("、")}]` : ""}`
    )
    .join("\n");
  const tags = formatTagBlock(projectTags, chapter.tags, "chapter", "general");
  const intensity = chapter.intensityNote || chapter.eroticNote || "无";
  return `请根据完整大纲，撰写**其中一章**的详细正文。

## 人物设定
${formatCharacters(characters)}

## 故事背景
${formatBackground(background)}

## 写作参数
${formatSettings(settings, "general")}
${tags ? `\n## 类型标签\n${tags}\n` : ""}
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
节奏备注：${intensity}

${previousChapterSnippet ? `## 上一章结尾片段（衔接用）\n${previousChapterSnippet}\n` : ""}
## 正文要求
1. 只写本章正文，不要写「第X章」以外的元说明。
2. 开头可保留一行标题：# ${chapter.title}
3. 严格按文风与人称；人物口吻与设定一致。
4. 情节完整、有起承转合，与前后章可衔接。
5. 直接输出小说正文。`;
}

export function generalExpandCharacterUser(opts: {
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
  "age": "年龄，按故事需要填写（如 28；若为未成年配角则写实际年龄，禁止性化）",
  "appearance": "外貌与气质，80–150字，具体可感",
  "personality": "性格、说话方式、情绪模式，80–150字",
  "background": "出身、职业、重要过往，80–150字",
  "relationships": "与故事中他人的关系与张力",
  "notes": "口癖、癖好倾向、写作注意点"
}`;
}

export function generalOptimizeCharacterUser(opts: {
  character: Character;
  otherCharacters?: Character[];
  background?: StoryBackground;
  instruction?: string;
}): string {
  return `请优化并扩写以下人物设定：补全空白、理顺逻辑、增加可写细节，保留用户已写的核心设定与姓名（除非明显空白需命名）。年龄按故事需要保留或补全，禁止改写成「必须成年」。备注不要写「成人向」。
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

export function generalExpandBackgroundUser(opts: {
  seed: string;
  background?: StoryBackground;
  characters?: Character[];
  instruction?: string;
}): string {
  const current =
    opts.background && formatBackground(opts.background)
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
  "synopsis": "故事梗概 150–300 字：主线、冲突、情感走向",
  "setting": "世界与主要场景，具体地点与氛围",
  "era": "时代，如现代/民国/架空",
  "themes": "主题关键词，顿号分隔",
  "tone": "基调，如冷峻、温暖、荒诞、黑暗、史诗",
  "extra": "补充：必写桥段、不要写什么、世界观约束"
}`;
}

export function generalOptimizeBackgroundUser(opts: {
  background: StoryBackground;
  characters?: Character[];
  instruction?: string;
}): string {
  return `请优化并扩写以下故事背景：补全空白、增强冲突与氛围，保留用户核心意图。不要改写成成人向床戏故事，不要把基调默认成暧昧或禁忌甜宠。
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

export function generalExpandCastUser(opts: {
  seed: string;
  characterCount?: number;
  instruction?: string;
}): string {
  const n = Math.min(8, Math.max(1, opts.characterCount ?? 2));
  return `用户只用一句话/一小段描述了故事灵感。请一次性生成：故事背景 + ${n} 个核心人物设定。
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

export function generalOptimizeSettingsUser(opts: {
  settings: GenerationSettings;
  characters?: Character[];
  background?: StoryBackground;
  instruction?: string;
}): string {
  return `根据已有人物与故事背景，优化「生成参数」中的文风建议与额外写作指令，使后续大纲/正文更贴合故事。
${contextBlock(opts.characters, opts.background)}
## 当前参数
${formatSettings(opts.settings, "general")}
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

export function generalLearnStyleUser(opts: {
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

export function generalRewriteUser(opts: {
  mode: string;
  selectedText: string;
  fullContext?: string;
  instruction?: string;
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
}): string {
  return `请对下列小说正文片段进行改写。

## 改写目标
${opts.mode}
${opts.instruction ? `用户补充指令：${opts.instruction}` : ""}

## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings, "general")}

${opts.fullContext ? `## 所在章节上下文（供连贯，勿重复输出全文）\n${opts.fullContext.slice(0, 2500)}\n` : ""}
## 待改写片段
${opts.selectedText}

## 输出要求
1. 只输出改写后的正文片段，不要解释。
2. 保持人称、时态与前后可衔接。
3. 可保留非性化未成年配角（仅当故事需要）；禁止任何涉及未成年人的性内容。`;
}

export function generalPolishOutlineUser(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  outline: Outline;
  chapter: OutlineChapter;
  projectTags?: string[];
}): string {
  const others = opts.outline.chapters
    .filter((c) => c.id !== opts.chapter.id)
    .sort((a, b) => a.order - b.order)
    .map((c) => `${c.order}. 《${c.title}》— ${c.summary}`)
    .join("\n");
  return `请润色**单章大纲**（只改本章，保持与全书连贯）。

## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings, "general")}

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

## 输出 JSON（不要 markdown）
{
  "title": "润色后的章节标题",
  "summary": "3–8句剧情摘要",
  "keyPoints": "关键点，分号分隔",
  "intensityNote": "节奏/冲突/情绪强度备注"
}`;
}
