/** 旧项目 JSON 可能带 1–5；本版不展示、不写入提示词 */
export type EroticLevel = 1 | 2 | 3 | 4 | 5;

/** 人称 */
export type NarrativePerson = "first" | "second" | "third";

/** 文笔文风预设 */
export type WritingStyle =
  | "literary" // 文学细腻
  | "plain" // 朴实直白
  | "poetic" // 诗意唯美
  | "passionate" // 热情奔放
  | "restrained" // 克制暧昧
  | "dark" // 黑暗沉重
  | "humorous" // 轻松幽默
  | "custom" // 自定义描述
  | "learned"; // 从范文学习的固定文风

/** 本版只有常规小说。字段保留以便导入旧 JSON。 */
export type WritingBoard = "general";

export const CURRENT_SCHEMA_VERSION = 2 as const;

export function defaultVolumeId(projectId: string): string {
  return `${projectId}:vol:1`;
}

export interface Volume {
  id: string;
  order: number;
  title: string;
  summary: string;
}

export interface LoreEntry {
  id: string;
  title: string;
  body: string;
  keys: string[];
  category: "place" | "org" | "item" | "rule" | "other";
  enabled: boolean;
}

/** 锁定设定种类：身份/物种优先于「人物」 */
export type CanonKind =
  | "character"
  | "identity"
  | "relationship"
  | "place"
  | "item"
  | "fact";

/** 从原作抽出、作者可锁定的硬事实 */
export interface LockedCanonFact {
  id: string;
  name: string;
  kind: CanonKind;
  /** 一句不能被改写的原作事实 */
  statement: string;
  locked: boolean;
  aliases?: string[];
}

/** 本书挂载的原作底稿（焕新/扩写，不是从零遍构） */
export interface OriginalManuscript {
  title: string;
  /** 来源说明：文件名或「粘贴导入」 */
  sourceLabel: string;
  text: string;
  updatedAt: string;
}

/** 预留；2.0 政策与 UI 不读取。禁止据此做第三写作台。 */
export type ContentRating = "unrated" | "general" | "mature" | "adult";

export interface Character {
  id: string;
  name: string;
  gender: string;
  age: string;
  appearance: string;
  personality: string;
  background: string;
  relationships: string;
  /** 角色在故事中的定位，如主角/配角/对手 */
  role: string;
  /** 额外备注（癖好、禁忌、说话方式等） */
  notes: string;
  /** 可选别名，生成时一并注入 */
  aliases?: string[];
  /** 可选说话风格 */
  speechStyle?: string;
}

export interface StoryBackground {
  title: string;
  synopsis: string;
  setting: string;
  era: string;
  themes: string;
  tone: string;
  extra: string;
}

/** 从范文学习得到的固定文风档案 */
export interface LearnedStyle {
  id: string;
  name: string;
  writingBoard: WritingBoard;
  createdAt: string;
  updatedAt: string;
  /** 来源说明：文件名或「粘贴导入」 */
  sourceLabel: string;
  /** 原文采样字数 */
  sourceChars: number;
  overall: string;
  vocabulary: string;
  rhythm: string;
  narrative: string;
  dialogue: string;
  /** 旧档案可能带此字段；本版不请求、不展示 */
  extras?: string;
  sensory: string;
  structure: string;
  avoid: string;
  /** 合并后的固定风格指南（注入生成 Prompt） */
  styleGuide: string;
  /** 风格指纹短句，便于对照 */
  fingerprints: string[];
}

export interface GenerationSettings {
  /** 旧 JSON 兼容；新建不再写入 */
  eroticLevel?: EroticLevel;
  /** 正文/续写温度，默认 0.9 */
  temperature?: number;
  writingStyle: WritingStyle;
  customStyle: string;
  /** 启用的学习文风 ID（writingStyle === 'learned' 时使用） */
  learnedStyleId: string;
  /** 启用时的风格指南快照（导出项目/生成时不依赖库是否还在） */
  learnedStyleGuide: string;
  learnedStyleName: string;
  /** apply 学习文风时一并快照的指纹例句 */
  learnedStyleFingerprints?: string[];
  person: NarrativePerson;
  /** 目标篇幅：短/中/长 */
  length: "short" | "medium" | "long";
  language: "zh" | "en";
  /** 大纲章节数建议 */
  chapterCount: number;
  /** 额外写作指令 */
  extraInstructions: string;
  /** 写入 assemble system 末尾的用户附加规则；空则只用内置 pack */
  extraRules?: string;
}

export interface OutlineChapter {
  id: string;
  volumeId?: string;
  order: number;
  title: string;
  summary: string;
  /** 本章关键情节/冲突点 */
  keyPoints: string;
  /** 旧 JSON 别名；normalize 时并入 intensityNote */
  eroticNote?: string;
  /** 节奏 / 冲突 / 情绪强度备注 */
  intensityNote?: string;
  /** 本章强制体现的行为标签（生成本章时生效） */
  tags: string[];
  /** 本章出场人物 id；未选则生成时仍全量注入 */
  castIds?: string[];
}

export interface Outline {
  premise: string;
  chapters: OutlineChapter[];
  endingNote: string;
  raw?: string;
}

export interface ChapterVersion {
  id: string;
  content: string;
  createdAt: string;
  /** auto | manual | rewrite | continue | restore */
  label: string;
}

export type ChapterSceneStatus = "pending" | "accepted" | "skipped";

export interface ChapterScene {
  id: string;
  order: number;
  title: string;
  summary: string;
  /** 原句锚点：必须原样出现，润色不得改写 */
  verbatimAnchors?: string[];
  /** 本拍可推进的线索 id */
  threadIds?: string[];
  status?: ChapterSceneStatus;
}

export interface ChapterContent {
  chapterId: string;
  title: string;
  content: string;
  status: "idle" | "generating" | "done" | "error";
  error?: string;
  updatedAt: string;
  /** 最近版本快照（不含当前正文，生成前自动压栈） */
  versions?: ChapterVersion[];
  /** 分场景规划 */
  scenes?: ChapterScene[];
  /** AI 生成的本章摘要（供后续章衔接） */
  summary?: string;
  /** 摘要解析出的「本章触及」伏笔标题，不改 plotThreads 状态 */
  touchedThreads?: string[];
  /** 正文与锁定设定的可能冲突（只提示，不阻断） */
  canonWarnings?: string[];
  /** 本章摘要最近一次生成失败；保留旧摘要并允许重试 */
  summaryFailed?: boolean;
}

/** 人物一致性检查结果（自动/手动共用，写入项目以便切 tab 不丢） */
export interface ConsistencyReport {
  at: string;
  score: number;
  summary: string;
  issues: {
    severity: string;
    detail: string;
    suggestion: string;
    character?: string;
    chapter?: string;
  }[];
}

export type PlotThreadStatus = "planted" | "active" | "resolved";

/** 读者已知才进记忆包；仅作者的暗线不得泄漏 */
export type PlotThreadVisibility = "author_only" | "reader_known";

export type PlotThreadKind = "main" | "sub" | "foreshadow" | "dark" | "other";

/** 伏笔 / 线索 */
export interface PlotThread {
  id: string;
  title: string;
  note: string;
  status: PlotThreadStatus;
  plantChapterId?: string;
  resolveChapterId?: string;
  createdAt: string;
  updatedAt: string;
  /** 缺省：主线/支线/伏笔为读者已知，暗线为仅作者 */
  visibility?: PlotThreadVisibility;
  kind?: PlotThreadKind;
}

/** 全书批量生成任务（可序列化，暂停/续跑） */
export interface BookGenerationJob {
  id: string;
  status: "idle" | "running" | "paused" | "done" | "error";
  items: {
    chapterId: string;
    order: number;
    title: string;
    status: "pending" | "running" | "done" | "error" | "skipped";
    error?: string;
    partialContent?: string;
  }[];
  currentChapterId: string | null;
  createdAt: string;
  updatedAt: string;
  mode: "all" | "missing" | "retry_errors";
  /** M3「仅生成本卷」；禁止复用 mode */
  volumeId?: string;
}

export interface NovelProject {
  id: string;
  name: string;
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  writingBoard: WritingBoard;
  /** 预留；本版固定 unrated */
  contentRating: ContentRating;
  createdAt: string;
  updatedAt: string;
  characters: Character[];
  background: StoryBackground;
  lore?: LoreEntry[];
  volumes?: Volume[];
  settings: GenerationSettings;
  /** 类型 / 题材标签 */
  tags: string[];
  /** 旧转换向导归档；assemble 不读取 */
  archivedActTags?: string[];
  /** 原作底稿；空则走从零开写 */
  original?: OriginalManuscript | null;
  /** 从原作锁定的硬事实（人设/大纲/正文生成必须遵守） */
  canon?: LockedCanonFact[];
  outline: Outline | null;
  chapters: ChapterContent[];
  /** 伏笔 / 线索板 */
  plotThreads?: PlotThread[];
  /** 全书生成队列（中断后可续跑） */
  bookJob?: BookGenerationJob | null;
  /** 最近一次一致性检查（自动/手动同源） */
  lastConsistencyReport?: ConsistencyReport | null;
  promptPackId?: string;
}

/** 正文阅读偏好（全局） */
export interface ReaderPrefs {
  fontSize: number;
  /** system | serif | sans | mono */
  fontFamily: "system" | "serif" | "sans" | "mono";
  /** 内容最大宽度 rem */
  lineWidth: number;
  /** default | paper | night | sepia */
  theme: "default" | "paper" | "night" | "sepia";
  lineHeight: number;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 17,
  fontFamily: "system",
  lineWidth: 48,
  theme: "default",
  lineHeight: 2,
};

/** API 用量粗估 */
export interface UsageStats {
  totalRequests: number;
  totalCharsIn: number;
  totalCharsOut: number;
  byMode: Record<string, { requests: number; charsOut: number }>;
  lastUsedAt?: string;
}

export function createEmptyUsageStats(): UsageStats {
  return {
    totalRequests: 0,
    totalCharsIn: 0,
    totalCharsOut: 0,
    byMode: {},
  };
}

export function createEmptyPlotThread(title = ""): PlotThread {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    note: "",
    status: "planted",
    createdAt: now,
    updatedAt: now,
    visibility: "reader_known",
    kind: "other",
  };
}

export function plotThreadVisibility(
  t: Pick<PlotThread, "visibility" | "kind">
): PlotThreadVisibility {
  if (t.visibility === "author_only" || t.visibility === "reader_known") {
    return t.visibility;
  }
  return t.kind === "dark" ? "author_only" : "reader_known";
}

/** 记忆包只注入读者已知线索 */
export function isReaderKnownThread(
  t: Pick<PlotThread, "visibility" | "kind">
): boolean {
  return plotThreadVisibility(t) === "reader_known";
}

export const MAX_CHAPTER_VERSIONS = 12;

/** 生成前把当前正文压入版本栈 */
export function pushChapterVersion(
  chapter: ChapterContent,
  label: string
): ChapterContent {
  const content = chapter.content || "";
  if (!content.trim()) return chapter;
  const versions = [...(chapter.versions || [])];
  versions.unshift({
    id: crypto.randomUUID(),
    content,
    createdAt: new Date().toISOString(),
    label,
  });
  return {
    ...chapter,
    versions: versions.slice(0, MAX_CHAPTER_VERSIONS),
  };
}

/** 默认类型 / 题材标签 */
export const DEFAULT_GENERAL_TAG_LIBRARY = [
  "悬疑",
  "成长",
  "反转",
  "群像",
  "冒险",
  "科幻",
  "奇幻",
  "历史",
  "都市",
  "爱情",
  "复仇",
  "权谋",
  "公路",
  "日常",
  "悲剧",
  "喜剧",
  "武侠",
  "校园",
  "克苏鲁",
  "蒸汽朋克",
] as const;

/** 与 DEFAULT_GENERAL_TAG_LIBRARY 相同，兼容旧调用名 */
export const DEFAULT_TAG_LIBRARY = DEFAULT_GENERAL_TAG_LIBRARY;

/** 解析逗号 / 换行分隔的批量文本为去重标签列表 */
export function parseTagsFromText(text: string): string[] {
  if (!text?.trim()) return [];
  const parts = text
    .split(/[/／|｜,，;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

export function mergeTags(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const t of list || []) {
      const s = t.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

export function defaultContentRating(_board?: WritingBoard): ContentRating {
  return "unrated";
}

function resolveWritingBoard(_value?: unknown): WritingBoard {
  return "general";
}

const CANON_KINDS: CanonKind[] = [
  "character",
  "identity",
  "relationship",
  "place",
  "item",
  "fact",
];

const PLOT_VISIBILITIES: PlotThreadVisibility[] = [
  "author_only",
  "reader_known",
];

const PLOT_KINDS: PlotThreadKind[] = [
  "main",
  "sub",
  "foreshadow",
  "dark",
  "other",
];

const SCENE_STATUSES: ChapterSceneStatus[] = [
  "pending",
  "accepted",
  "skipped",
];

function normalizePlotThread(raw: PlotThread): PlotThread {
  const kind = PLOT_KINDS.includes(raw.kind as PlotThreadKind)
    ? (raw.kind as PlotThreadKind)
    : "other";
  const visibility = PLOT_VISIBILITIES.includes(
    raw.visibility as PlotThreadVisibility
  )
    ? (raw.visibility as PlotThreadVisibility)
    : kind === "dark"
      ? "author_only"
      : "reader_known";
  return {
    ...raw,
    id: raw.id || crypto.randomUUID(),
    title: String(raw.title || "").trim(),
    note: String(raw.note || ""),
    status: raw.status === "active" || raw.status === "resolved" ? raw.status : "planted",
    kind,
    visibility,
  };
}

function normalizeChapterScene(raw: ChapterScene, index: number): ChapterScene {
  const status = SCENE_STATUSES.includes(raw.status as ChapterSceneStatus)
    ? (raw.status as ChapterSceneStatus)
    : "pending";
  return {
    id: raw.id || crypto.randomUUID(),
    order: typeof raw.order === "number" ? raw.order : index + 1,
    title: String(raw.title || "").trim(),
    summary: String(raw.summary || ""),
    verbatimAnchors: Array.isArray(raw.verbatimAnchors)
      ? raw.verbatimAnchors.map((s) => String(s).trim()).filter(Boolean)
      : undefined,
    threadIds: Array.isArray(raw.threadIds)
      ? raw.threadIds.map((s) => String(s).trim()).filter(Boolean)
      : undefined,
    status,
  };
}

function resolveCanonKind(value: unknown): CanonKind {
  return CANON_KINDS.includes(value as CanonKind)
    ? (value as CanonKind)
    : "fact";
}

export function createEmptyCanonFact(
  name = "",
  statement = "",
  kind: CanonKind = "fact"
): LockedCanonFact {
  return {
    id: crypto.randomUUID(),
    name,
    kind,
    statement,
    locked: true,
    aliases: [],
  };
}

export function createEmptyOriginalManuscript(
  title = "",
  sourceLabel = "粘贴导入"
): OriginalManuscript {
  return {
    title,
    sourceLabel,
    text: "",
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeOriginalManuscript(
  raw: NovelProject["original"] | undefined
): OriginalManuscript | null {
  if (!raw || typeof raw !== "object") return null;
  const text = typeof raw.text === "string" ? raw.text : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const sourceLabel =
    typeof raw.sourceLabel === "string" ? raw.sourceLabel : "";
  if (!text.trim() && !title.trim() && !sourceLabel.trim()) return null;
  return {
    title,
    sourceLabel: sourceLabel || "粘贴导入",
    text,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : "",
  };
}

export function normalizeLockedCanon(
  raw: NovelProject["canon"] | undefined
): LockedCanonFact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is LockedCanonFact => Boolean(f && typeof f === "object"))
    .map((f) => ({
      id: f.id || crypto.randomUUID(),
      name: String(f.name || "").trim(),
      kind: resolveCanonKind(f.kind),
      statement: String(f.statement || "").trim(),
      locked: f.locked !== false,
      aliases: Array.isArray(f.aliases)
        ? f.aliases.map((a) => String(a).trim()).filter(Boolean)
        : [],
    }))
    .filter((f) => f.name || f.statement);
}

function ensureVolumes(projectId: string, volumes?: Volume[]): Volume[] {
  const existing = Array.isArray(volumes) ? volumes.filter(Boolean) : [];
  if (existing.length) {
    return existing.map((v, i) => ({
      id: v.id || defaultVolumeId(projectId),
      order: typeof v.order === "number" ? v.order : i + 1,
      title: v.title || `第 ${i + 1} 卷`,
      summary: v.summary || "",
    }));
  }
  return [
    {
      id: defaultVolumeId(projectId),
      order: 1,
      title: "第一卷",
      summary: "",
    },
  ];
}

/** 兼容旧项目数据，补齐 writingBoard / schemaVersion / 默认卷 / tags / 文风 / 伏笔 / 版本字段 */
export function normalizeProject(p: NovelProject): NovelProject {
  const settings = p.settings || createDefaultSettings();
  const writingBoard = resolveWritingBoard(p.writingBoard);
  const volumes = ensureVolumes(p.id, p.volumes);
  const defaultVolId = volumes[0]?.id || defaultVolumeId(p.id);
  return {
    ...p,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    writingBoard,
    contentRating: p.contentRating || defaultContentRating(writingBoard),
    volumes,
    characters: normalizeCharacters(p.characters),
    lore: Array.isArray(p.lore) ? p.lore : [],
    original: normalizeOriginalManuscript(p.original),
    canon: normalizeLockedCanon(p.canon),
    tags: Array.isArray(p.tags) ? p.tags : [],
    archivedActTags: Array.isArray(p.archivedActTags) ? p.archivedActTags : [],
    plotThreads: Array.isArray(p.plotThreads)
      ? p.plotThreads
          .filter((t): t is PlotThread => Boolean(t && typeof t === "object"))
          .map(normalizePlotThread)
      : [],
    bookJob: p.bookJob ?? null,
    lastConsistencyReport: p.lastConsistencyReport ?? null,
    settings: {
      ...createDefaultSettings(),
      ...settings,
      learnedStyleId: settings.learnedStyleId || "",
      learnedStyleGuide: settings.learnedStyleGuide || "",
      learnedStyleName: settings.learnedStyleName || "",
      learnedStyleFingerprints: Array.isArray(settings.learnedStyleFingerprints)
        ? settings.learnedStyleFingerprints.map((s) => String(s).trim()).filter(Boolean)
        : [],
    },
    outline: p.outline
      ? {
          ...p.outline,
          chapters: (p.outline.chapters || []).map((c) => {
            const intensityNote =
              (typeof c.intensityNote === "string" ? c.intensityNote : "") ||
              c.eroticNote ||
              "";
            const next = {
              ...c,
              volumeId: c.volumeId || defaultVolId,
              tags: Array.isArray(c.tags) ? c.tags : [],
              intensityNote,
              castIds: Array.isArray(c.castIds)
                ? c.castIds.map((id) => String(id).trim()).filter(Boolean)
                : [],
            };
            delete next.eroticNote;
            return next;
          }),
        }
      : null,
    chapters: (p.chapters || []).map((c) => ({
      ...c,
      versions: Array.isArray(c.versions) ? c.versions : [],
      scenes: Array.isArray(c.scenes)
        ? c.scenes
            .filter((s): s is ChapterScene => Boolean(s && typeof s === "object"))
            .map(normalizeChapterScene)
        : undefined,
      summary: c.summary || "",
      touchedThreads: Array.isArray(c.touchedThreads)
        ? c.touchedThreads.map((s) => String(s).trim()).filter(Boolean)
        : undefined,
      canonWarnings: Array.isArray(c.canonWarnings) ? c.canonWarnings : undefined,
    })),
  };
}

export function assertWritingBoardImmutable(
  prev: NovelProject | undefined,
  next: NovelProject
): void {
  if (prev && prev.writingBoard !== next.writingBoard) {
    throw new Error("WRITING_BOARD_LOCKED");
  }
}

export function normalizeLearnedStyle(s: LearnedStyle): LearnedStyle {
  const extras =
    typeof s.extras === "string"
      ? s.extras
      : typeof (s as LearnedStyle & { erotic?: string }).erotic === "string"
        ? (s as LearnedStyle & { erotic?: string }).erotic
        : undefined;
  return {
    ...s,
    writingBoard: "general",
    extras,
  };
}

/** 长文采样：头+中+尾，控制学习请求体量 */
export function sampleTextForStyleLearning(
  text: string,
  maxChars = 14000
): string {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= maxChars) return clean;
  const chunk = Math.floor(maxChars / 3);
  const midStart = Math.max(0, Math.floor(clean.length / 2) - Math.floor(chunk / 2));
  const head = clean.slice(0, chunk);
  const mid = clean.slice(midStart, midStart + chunk);
  const tail = clean.slice(-chunk);
  return [
    "【开头采样】\n" + head,
    "\n\n【中段采样】\n" + mid,
    "\n\n【结尾采样】\n" + tail,
  ].join("");
}

export const STYLE_LABELS: Record<WritingStyle, string> = {
  literary: "文学细腻",
  plain: "朴实直白",
  poetic: "诗意唯美",
  passionate: "热情奔放",
  restrained: "克制暧昧",
  dark: "黑暗沉重",
  humorous: "轻松幽默",
  custom: "自定义",
  learned: "学习文风（固定）",
};

export const PERSON_LABELS: Record<NarrativePerson, string> = {
  first: "第一人称（我）",
  second: "第二人称（你）",
  third: "第三人称",
};

export const LENGTH_RANGES = {
  short: { min: 800, max: 1500 },
  medium: { min: 1500, max: 3000 },
  long: { min: 3000, max: 5000 },
} as const;

export type ChapterLength = keyof typeof LENGTH_RANGES;

export const LENGTH_LABELS: Record<ChapterLength, string> = {
  short: `短篇（${LENGTH_RANGES.short.min}–${LENGTH_RANGES.short.max}字/章）`,
  medium: `中篇（${LENGTH_RANGES.medium.min}–${LENGTH_RANGES.medium.max}字/章）`,
  long: `长篇（${LENGTH_RANGES.long.min}–${LENGTH_RANGES.long.max}字/章）`,
};

export function createEmptyCharacter(): Character {
  return {
    id: crypto.randomUUID(),
    name: "",
    gender: "",
    age: "",
    appearance: "",
    personality: "",
    background: "",
    relationships: "",
    role: "主角",
    notes: "",
    aliases: [],
    speechStyle: "",
  };
}

export function normalizeCharacter(
  raw: Partial<Character> | null | undefined
): Character {
  const base = createEmptyCharacter();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    id: String(raw.id || base.id),
    name: String(raw.name || ""),
    gender: String(raw.gender || ""),
    age: String(raw.age || ""),
    appearance: String(raw.appearance || ""),
    personality: String(raw.personality || ""),
    background: String(raw.background || ""),
    relationships: String(raw.relationships || ""),
    role: String(raw.role || base.role),
    notes: String(raw.notes || ""),
    aliases: Array.isArray(raw.aliases)
      ? raw.aliases.map((a) => String(a).trim()).filter(Boolean)
      : [],
    speechStyle: String(raw.speechStyle || ""),
  };
}

export function normalizeCharacters(raw: unknown): Character[] {
  if (!Array.isArray(raw)) return [createEmptyCharacter()];
  return raw
    .filter((c): c is Partial<Character> => Boolean(c && typeof c === "object"))
    .map(normalizeCharacter);
}

export function createDefaultBackground(): StoryBackground {
  return {
    title: "",
    synopsis: "",
    setting: "",
    era: "现代",
    themes: "",
    tone: "",
    extra: "",
  };
}

export function createDefaultSettings(): GenerationSettings {
  return {
    writingStyle: "literary",
    customStyle: "",
    learnedStyleId: "",
    learnedStyleGuide: "",
    learnedStyleName: "",
    learnedStyleFingerprints: [],
    person: "third",
    length: "medium",
    language: "zh",
    chapterCount: 5,
    extraInstructions: "",
    extraRules: "",
    temperature: 0.9,
  };
}

/** 正文/续写温度；未设置时与历史默认 0.9 一致 */
export function resolveChapterTemperature(
  settings?: Pick<GenerationSettings, "temperature"> | null
): number {
  const t = settings?.temperature;
  return typeof t === "number" && Number.isFinite(t) ? t : 0.9;
}

export function createEmptyProject(
  name = "未命名小说",
  _writingBoard?: WritingBoard
): NovelProject {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    writingBoard: "general",
    contentRating: "unrated",
    createdAt: now,
    updatedAt: now,
    characters: [createEmptyCharacter()],
    background: createDefaultBackground(),
    lore: [],
    original: null,
    canon: [],
    volumes: [
      {
        id: defaultVolumeId(id),
        order: 1,
        title: "第一卷",
        summary: "",
      },
    ],
    settings: createDefaultSettings(),
    tags: [],
    archivedActTags: [],
    outline: null,
    chapters: [],
    plotThreads: [],
    bookJob: null,
  };
}
