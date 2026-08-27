import type {
  Character,
  GenerationSettings,
  Outline,
  OutlineChapter,
  StoryBackground,
  Volume,
} from "../types";
import { chapterLengthRequirement, continueLengthRequirement, countChapterChars } from "../length";
import { mergeTags } from "../types";
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
      "intensityNote": "可选：节奏/冲突/情绪强度备注；无则空字符串",
      "hook": "章末钩子：本章结尾要悬着的事；无则空字符串",
      "cast": ["出场人物姓名"]
    }
  ]
}`;
}

function formatOutlineChapterLine(c: OutlineChapter): string {
  return `${c.order}. 《${c.title}》— ${c.summary}${(c.tags || []).length ? ` [标签：${(c.tags || []).join("、")}]` : ""}`;
}

function volumeOneLiner(volume: Volume, chapters: OutlineChapter[]): string {
  const summary = (volume.summary || "").trim();
  if (summary) return `《${volume.title}》：${summary}`;
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  if (!sorted.length) return `《${volume.title}》：（无章节）`;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.id === last.id) return `《${volume.title}》：${first.title}`;
  return `《${volume.title}》：${first.title} … ${last.title}`;
}

/** 本卷详、他卷一行；无分卷或总章数 ≤ 15 时与逐章全量一致 */
export function formatBookOutlineForChapter(
  outline: Outline,
  chapter: OutlineChapter,
  volumes?: Volume[]
): string {
  const chapters = outline.chapters || [];
  const vols = [...(volumes || [])].sort((a, b) => a.order - b.order);
  if (vols.length <= 1 || chapters.length <= 15) {
    return chapters.map(formatOutlineChapterLine).join("\n");
  }
  const currentVolId = chapter.volumeId || vols[0]?.id;
  return vols
    .map((vol) => {
      const inVol = chapters.filter(
        (c) => (c.volumeId || vols[0]?.id) === vol.id
      );
      if (vol.id === currentVolId) {
        return inVol.map(formatOutlineChapterLine).join("\n");
      }
      return volumeOneLiner(vol, inVol);
    })
    .filter(Boolean)
    .join("\n");
}

export function generalChapterUser(
  characters: Character[],
  background: StoryBackground,
  settings: GenerationSettings,
  outline: Outline,
  chapter: OutlineChapter,
  previousChapterSnippet?: string,
  projectTags?: string[],
  priorBlock?: string,
  volumes?: Volume[]
): string {
  const allChapters = formatBookOutlineForChapter(outline, chapter, volumes);
  const tags = formatTagBlock(projectTags, chapter.tags, "chapter", "general");
  const intensity = chapter.intensityNote || chapter.eroticNote || "无";
  const lengthRule = chapterLengthRequirement(settings.length, settings.customLength);
  const memory = (priorBlock || "").trim();
  return `请根据完整大纲，撰写**其中一章**的详细正文。

## 人物设定
${formatCharacters(characters, { castIds: chapter.castIds })}

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
${memory ? `\n${memory}\n` : previousChapterSnippet ? `\n## 上一章结尾片段（衔接用）\n${previousChapterSnippet}\n` : ""}
## 当前要写的章节
章节序号：${chapter.order}
标题：${chapter.title}
摘要：${chapter.summary}
关键点：${chapter.keyPoints}
节奏备注：${intensity}

## 正文要求
1. 只写本章正文，不要写「第X章」以外的元说明。
2. 开头可保留一行标题：# ${chapter.title}
3. 严格按文风与人称；人物口吻与设定一致。
4. ${
    settings.serialMode
      ? `开头 1–2 段承接上一章结尾的悬念，不要另起炉灶；结尾必须停在钩子上（本章钩子：${chapter.hook || "（未填）"}），禁止把冲突写完、禁止总结式收尾`
      : "情节完整、有起承转合，与前后章可衔接。"
  }
5. ${lengthRule}
6. 直接输出小说正文。`;
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
  priorBlock?: string;
  expandScale?: number;
  expandTargetChars?: number;
  verbatimAnchors?: string[];
}): string {
  const expand =
    opts.mode === "expand" || String(opts.mode).includes("扩写");
  const target =
    expand && opts.expandTargetChars
      ? `扩写目标：至少写到约 ${opts.expandTargetChars} 字（约 ${opts.expandScale || 2} 倍），不要低于该目标的 80%。`
      : expand
        ? "扩写目标：按选区加长，至少 1.5 倍，不要只改几个词。"
        : "";
  const memory = (opts.priorBlock || "").trim();
  return `请对下列小说正文片段进行改写。

## 改写目标
${opts.mode}
${opts.instruction ? `用户补充指令：${opts.instruction}` : ""}
${target}

${memory ? `## 前情记忆（连贯用）\n${memory}\n` : ""}
## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings, "general")}

${opts.fullContext ? `## 所在章节上下文（选区前后滑窗，供连贯，勿重复输出全文）\n${opts.fullContext}\n` : ""}
## 待改写片段
${opts.selectedText}

## 输出要求
1. 只输出改写后的正文片段，不要解释。
2. 保持人称、时态与前后可衔接。
3. 可保留非性化未成年配角（仅当故事需要）；禁止任何涉及未成年人的性内容。
${
  opts.verbatimAnchors?.length
    ? `4. 下列原句必须原样保留，润色不得改写：\n${opts.verbatimAnchors.map((a) => `- ${a}`).join("\n")}`
    : ""
}`;
}

export function generalVolumeOutlineUser(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  volume: Volume;
  previousEnding?: string;
  chapterCount: number;
  projectTags?: string[];
}): string {
  const tags = formatTagBlock(opts.projectTags, undefined, "outline", "general");
  const n = Math.max(3, Math.min(20, opts.chapterCount || 10));
  return `请只为**这一卷**生成可编辑的章节大纲，不要规划其它卷。

## 本卷
标题：${opts.volume.title}
卷摘要/主题：${opts.volume.summary || "（未填写，请根据人物与背景自拟本卷弧线）"}
期望章数：${n} 章（可 ±2）

${opts.previousEnding ? `## 前卷终局状态（本卷须接上，勿重置）\n${opts.previousEnding}\n` : ""}
## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 生成参数
${formatSettings(opts.settings, "general")}
${tags ? `\n## 类型标签\n${tags}\n` : ""}
## 输出要求
请严格输出如下 JSON（不要 markdown 代码块，不要其它说明文字）：
{
  "premise": "本卷弧线一句话",
  "endingNote": "本卷收束走向",
  "chapters": [
    {
      "order": 1,
      "title": "章节标题",
      "summary": "本章剧情摘要（3–6句）",
      "keyPoints": "关键情节点/冲突/转折，分号分隔",
      "intensityNote": "可选：节奏/冲突/情绪强度备注；无则空字符串",
      "hook": "章末钩子：本章结尾要悬着的事；无则空字符串",
      "cast": ["出场人物姓名"]
    }
  ]
}
chapters 长度约为 ${n}。`;
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

export function generalContinueUser(opts: {
  existingText: string;
  instruction?: string;
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  chapter?: OutlineChapter;
  outlineContext?: string;
  previousSummary?: string;
  previousSummaries?: string;
  plotThreads?: string;
  characterStateCard?: string;
  lore?: string;
  priorBlock?: string;
}): string {
  const previousSummary = opts.previousSummary || opts.previousSummaries;
  const memory = (opts.priorBlock || "").trim();
  return `请从给定正文**末尾自然续写**，不要重复已有内容。

## 人物设定
${formatCharacters(opts.characters, { castIds: opts.chapter?.castIds })}

## 故事背景
${formatBackground(opts.background)}

## 写作参数
${formatSettings(opts.settings, "general")}
${memory ? `\n${memory}\n` : ""}${!memory && opts.characterStateCard ? `## 角色状态卡\n${opts.characterStateCard}\n` : ""}
${opts.chapter ? `## 本章目标\n标题：${opts.chapter.title}\n摘要：${opts.chapter.summary}\n关键点：${opts.chapter.keyPoints}\n` : ""}
${opts.outlineContext ? `## 大纲参考\n${opts.outlineContext}\n` : ""}
${!memory && previousSummary ? `## 前情摘要\n${previousSummary}\n` : ""}
${!memory && opts.plotThreads ? `## 伏笔线索（可推进，勿无故遗忘）\n${opts.plotThreads}\n` : ""}
${!memory && opts.lore ? `## 世界观设定（关键词命中）\n${opts.lore}\n` : ""}
${opts.instruction ? `## 续写方向\n${opts.instruction}\n` : ""}
## 已有正文（请接在其后）
${opts.existingText.slice(-6000)}

## 输出要求
1. 只输出续写部分，不要重复上文。
2. 保持文风、人称、尺度一致，情节连贯；称呼与人物状态勿漂移。
3. ${continueLengthRequirement(opts.settings, countChapterChars(opts.existingText))}${
    opts.settings.serialMode
      ? `\n4. 若尚未落到钩子上，结尾停在钩子（本章钩子：${opts.chapter?.hook || "（未填）"}），禁止总结式收尾。`
      : ""
  }`;
}

export function generalNextChaptersUser(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  volume: Volume;
  chapterCount: number;
  recentSummaries: { order: number; title: string; summary: string }[];
  openThreads?: string[];
  characterStates?: string;
  projectTags?: string[];
}): string {
  const tags = formatTagBlock(opts.projectTags, undefined, "outline", "general");
  const n = Math.max(1, Math.min(20, opts.chapterCount || 10));
  const summaries =
    opts.recentSummaries
      .map(
        (c) =>
          `第${c.order}章《${c.title}》：${(c.summary || "").trim() || "（无摘要）"}`
      )
      .join("\n") || "（无）";
  const threads = (opts.openThreads || []).join("\n") || "（无）";
  const arc = [
    opts.volume.summary && `卷摘要：${opts.volume.summary}`,
    opts.volume.arcGoal && `本卷弧线目标：${opts.volume.arcGoal}`,
    opts.volume.exitState && `出卷局面：${opts.volume.exitState}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `请根据**已经写出来的前情**续排本卷接下来的 ${n} 章大纲。只追加新章，不要改写已有章，不要输出已写正文。

## 本卷
标题：${opts.volume.title}
${arc || "（未填写弧线，请根据前情自拟本批走向）"}
期望续排章数：${n} 章（可 ±2，上限 20）

## 最近章节实际摘要（优先 AI 摘要，不要当正文）
${summaries}

## 未回收的读者已知伏笔
${threads}

${opts.characterStates ? `## 人物状态账本\n${opts.characterStates}\n` : ""}
## 人物设定
${formatCharacters(opts.characters)}

## 故事背景
${formatBackground(opts.background)}

## 生成参数
${formatSettings(opts.settings, "general")}
${tags ? `\n## 类型标签\n${tags}\n` : ""}
## 输出要求
请严格输出如下 JSON（不要 markdown 代码块，不要其它说明文字）：
{
  "premise": "本批弧线一句话",
  "endingNote": "本批收束走向",
  "chapters": [
    {
      "order": 1,
      "title": "章节标题",
      "summary": "本章剧情摘要（3–6句）",
      "keyPoints": "关键情节点/冲突/转折，分号分隔",
      "intensityNote": "可选：节奏/冲突/情绪强度备注；无则空字符串",
      "hook": "章末钩子：本章结尾要悬着的事；无则空字符串",
      "cast": ["出场人物姓名"]
    }
  ]
}
chapters 长度约为 ${n}。只写新章，不要重复已有章。`;
}

export function generalScenePlanUser(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  chapter: OutlineChapter;
  projectTags?: string[];
}): string {
  const intensity = `节奏：${opts.chapter.intensityNote || opts.chapter.eroticNote || "无"}`;
  return `把本章拆成 3–6 个可连续写作的场景，便于分场景生成正文。

## 人物
${formatCharacters(opts.characters, { castIds: opts.chapter.castIds })}

## 背景
${formatBackground(opts.background)}

## 参数
${formatSettings(opts.settings, "general")}

## 本章大纲
标题：${opts.chapter.title}
摘要：${opts.chapter.summary}
关键点：${opts.chapter.keyPoints}
${intensity}
标签：${mergeTags(opts.projectTags, opts.chapter.tags).join("、") || "无"}

## 输出 JSON
{
  "scenes": [
    {
      "order": 1,
      "title": "场景名",
      "summary": "本场景要写什么（2-4句）",
      "verbatimAnchors": ["可选：必须原样保留的原句"]
    }
  ]
}`;
}

export function generalSceneChapterUser(opts: {
  characters: Character[];
  background: StoryBackground;
  settings: GenerationSettings;
  chapter: OutlineChapter;
  scene: { order: number; title: string; summary: string; verbatimAnchors?: string[] };
  previousScenesText?: string;
  previousChapterSnippet?: string;
  projectTags?: string[];
  plotThreads?: string;
  lore?: string;
  priorBlock?: string;
  beatContractBlock?: string;
}): string {
  const memory = (opts.priorBlock || "").trim();
  const anchors = opts.scene.verbatimAnchors?.filter(Boolean) || [];
  return `撰写本章中的**一个场景**正文（不是整章）。

## 人物
${formatCharacters(opts.characters, { castIds: opts.chapter.castIds })}

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
${memory ? `${memory}\n` : opts.previousChapterSnippet ? `## 上章结尾\n${opts.previousChapterSnippet}\n` : ""}
${!memory && opts.plotThreads ? `## 伏笔\n${opts.plotThreads}\n` : ""}
${!memory && opts.lore ? `## 世界观设定（关键词命中）\n${opts.lore}\n` : ""}
${opts.beatContractBlock ? `${opts.beatContractBlock}\n` : ""}
${
  anchors.length
    ? `## 原句锚点（必须原样出现，润色不得改写）\n${anchors.map((a) => `- ${a}`).join("\n")}\n`
    : ""
}
## 要求
1. 只写本场景，约 400–1500 字。先输出到预览，不要当成已定稿。
2. 不要写「场景X」元标题；可自然过渡。
3. 直接输出正文。不得泄漏仅作者可见的暗线。
4. 有原句锚点时必须原样写入，不得改写。`;
}

export function generalVolumeSummaryUser(opts: {
  volume: Volume;
  chapterSummaries: { order: number; title: string; summary: string }[];
}): string {
  const rows = opts.chapterSummaries
    .map(
      (c) =>
        `第${c.order}章《${c.title}》：${(c.summary || "").trim() || "（无摘要）"}`
    )
    .join("\n");
  return `请根据本卷各章摘要，写一段 100–200 字的卷摘要，供后续卷衔接使用。
只写已发生的事实与未解冲突，不要剧透未写章节，不要标题。

## 本卷
标题：${opts.volume.title}
已有卷摘要（可参考改写）：${opts.volume.summary || "（无）"}

## 各章摘要
${rows || "（无）"}`;
}
