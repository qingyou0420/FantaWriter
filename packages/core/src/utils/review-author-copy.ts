/**
 * Author-facing review copy. Rule ids may stay internal; yellow-card
 * titles and bodies must read like an editor talking to a novelist.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type ReviewCopyLanguage = "zh" | "en";

export interface ReviewCopyIssue {
  readonly severity: string;
  readonly category: string;
  readonly description: string;
  readonly suggestion?: string;
}

const CATEGORY_ZH: Record<string, string> = {
  continuity: "连贯性",
  character: "人物",
  characters: "人物",
  timeline: "时间线",
  world: "世界规则",
  "world-rule": "世界规则",
  lore: "世界规则",
  style: "文风",
  voice: "文风",
  hook: "伏笔",
  plot: "情节",
  pacing: "节奏",
  ooc: "人设走样",
  "ooc检查": "人设走样",
  "ooc check": "人设走样",
  "时间线检查": "时间线",
  "timeline check": "时间线",
  "设定冲突": "设定冲突",
  "lore conflict check": "设定冲突",
  "战力崩坏": "战力崩坏",
  "power scaling check": "战力崩坏",
  "数值检查": "数值",
  "numerical consistency check": "数值",
  "伏笔检查": "伏笔",
  "hook check": "伏笔",
  "节奏检查": "节奏",
  "pacing check": "节奏",
  "文风检查": "文风",
  "style check": "文风",
  "信息越界": "不该知道的信息",
  "information boundary check": "不该知道的信息",
  "词汇疲劳": "用词习惯",
  "lexical fatigue": "用词习惯",
  "lexical fatigue check": "用词习惯",
  "利益链断裂": "利益关系",
  "incentive chain check": "利益关系",
  "年代考据": "年代",
  "era accuracy check": "年代",
  "配角降智": "配角降智",
  "side character competence check": "配角降智",
  "配角工具人化": "配角工具人",
  "side character instrumentalization check": "配角工具人",
  "爽点虚化": "爽点不够",
  "payoff dilution check": "爽点不够",
  "台词失真": "台词",
  "dialogue authenticity check": "台词",
  "流水账": "流水账",
  "chronicle drift check": "流水账",
  "知识库污染": "设定串台",
  "knowledge base pollution check": "设定串台",
  "视角一致性": "视角",
  "pov consistency check": "视角",
  "段落等长": "段落节奏",
  "paragraph uniformity": "段落节奏",
  "paragraph uniformity check": "段落节奏",
  "套话密度": "套话太多",
  "hedge density": "套话太多",
  "cliche density check": "套话太多",
  "公式化转折": "转折套式",
  "formulaic transitions": "转折套式",
  "formulaic twist check": "转折套式",
  "列表式结构": "句式排比",
  "list-like structure": "句式排比",
  "list-like structure check": "句式排比",
  "支线停滞": "支线停滞",
  "subplot stagnation check": "支线停滞",
  "弧线平坦": "情绪弧线",
  "arc flatline check": "情绪弧线",
  "节奏单调": "节奏单调",
  "pacing monotony": "节奏单调",
  "pacing monotony check": "节奏单调",
  "敏感词检查": "敏感词",
  "sensitive content check": "敏感词",
  "敏感词": "敏感词",
  "sensitive terms": "敏感词",
  "正传事件冲突": "与正传冲突",
  "mainline canon event conflict": "与正传冲突",
  "未来信息泄露": "不该提前知道的事",
  "future knowledge leak check": "不该提前知道的事",
  "世界规则跨书一致性": "世界规则",
  "cross-book world rule check": "世界规则",
  "番外伏笔隔离": "番外伏笔",
  "spinoff hook isolation check": "番外伏笔",
  "读者期待管理": "读者期待",
  "reader expectation check": "读者期待",
  "章节备忘偏离": "本章是否写到",
  "chapter memo drift": "本章是否写到",
  "chapter memo drift check": "本章是否写到",
  "角色还原度": "角色还原",
  "character fidelity check": "角色还原",
  "世界规则遵守": "世界规则",
  "world rule compliance check": "世界规则",
  "关系动态": "人物关系",
  "relationship dynamics check": "人物关系",
  "正典事件一致性": "正典事件",
  "canon event consistency check": "正典事件",
  "hook 账需语义复核": "伏笔是否写到",
  "伏笔是否写到": "伏笔是否写到",
  "hook 账揭 1 埋 1 违规": "揭一埋一",
  "揭一埋一": "揭一埋一",
  "paragraph-shape": "段落太碎",
  "paragraph fragmentation": "段落太碎",
  "consecutive short paragraphs": "段落太碎",
  "paragraph density drift": "段落太碎",
  "段落过碎": "段落太碎",
  "连续短段": "段落太碎",
  "段落密度漂移": "段落太碎",
  "段落过长": "段落太长",
  "paragraph length": "段落太长",
  "title-dedup": "章节标题",
  "标题重复": "章节标题",
  "title collapse": "章节标题",
  "length-budget": "章节字数",
  "hook-debt": "伏笔逾期",
  "hook debt": "伏笔逾期",
  "伏笔债务": "伏笔逾期",
  "伏笔逾期": "伏笔逾期",
  "state-validation": "前后文对不上",
  "state-conflict": "前后文对不上",
  "audit": "审稿",
  "review": "审稿",
  "未分类": "审稿",
  uncategorized: "审稿",
  "系统错误": "审稿",
  "system error": "审稿",
  "模型审稿判断": "审稿",
  "禁止句式": "句式",
  "禁止破折号": "标点",
  "报告术语": "用词",
  "章节号指称": "章节号",
  "chapter-number-reference": "章节号",
  "本书禁忌": "本书禁忌",
  "book prohibition": "本书禁忌",
  "叙事人称": "人称",
  "作者说教": "说教",
  "集体反应": "集体反应",
  "连续了字": "「了」字太多",
  "元叙事": "旁白说戏",
  "高疲劳词": "用词习惯",
  "转折词密度": "用词习惯",
  "跨章重复": "跨章重复",
  "cross-chapter repetition": "跨章重复",
  "ai-tell word density": "用词习惯",
  "fatigue word": "用词习惯",
  "dialogue pressure": "对白",
  "情绪单调": "情绪单调",
  "mood monotony": "情绪单调",
  "开头同构": "开篇套式",
  "结尾同构": "章尾套式",
  "opening pattern repetition": "开篇套式",
  "ending pattern repetition": "章尾套式",
  "aigc检测": "生成痕迹",
};

const CATEGORY_EN: Record<string, string> = {
  continuity: "Continuity",
  character: "Character",
  characters: "Character",
  timeline: "Timeline",
  world: "World rules",
  "world-rule": "World rules",
  lore: "World rules",
  style: "Style",
  voice: "Voice",
  hook: "Planted thread",
  plot: "Plot",
  pacing: "Pacing",
  ooc: "Character drift",
  "ooc检查": "Character drift",
  "ooc check": "Character drift",
  "时间线检查": "Timeline",
  "timeline check": "Timeline",
  "设定冲突": "Setting clash",
  "lore conflict check": "Setting clash",
  "战力崩坏": "Power scaling",
  "power scaling check": "Power scaling",
  "数值检查": "Numbers",
  "numerical consistency check": "Numbers",
  "伏笔检查": "Planted thread",
  "hook check": "Planted thread",
  "节奏检查": "Pacing",
  "pacing check": "Pacing",
  "文风检查": "Style",
  "style check": "Style",
  "信息越界": "Something they shouldn't know",
  "information boundary check": "Something they shouldn't know",
  "词汇疲劳": "Word habits",
  "lexical fatigue": "Word habits",
  "lexical fatigue check": "Word habits",
  "利益链断裂": "Incentives",
  "incentive chain check": "Incentives",
  "年代考据": "Period detail",
  "era accuracy check": "Period detail",
  "配角降智": "Side character",
  "side character competence check": "Side character",
  "配角工具人化": "Side character",
  "side character instrumentalization check": "Side character",
  "爽点虚化": "Payoff",
  "payoff dilution check": "Payoff",
  "台词失真": "Dialogue",
  "dialogue authenticity check": "Dialogue",
  "流水账": "Chronicle drift",
  "chronicle drift check": "Chronicle drift",
  "知识库污染": "Setting bleed",
  "knowledge base pollution check": "Setting bleed",
  "视角一致性": "Point of view",
  "pov consistency check": "Point of view",
  "段落等长": "Paragraph rhythm",
  "paragraph uniformity": "Paragraph rhythm",
  "paragraph uniformity check": "Paragraph rhythm",
  "套话密度": "Hedge words",
  "hedge density": "Hedge words",
  "cliche density check": "Hedge words",
  "公式化转折": "Formulaic turns",
  "formulaic transitions": "Formulaic turns",
  "formulaic twist check": "Formulaic turns",
  "列表式结构": "List-like sentences",
  "list-like structure": "List-like sentences",
  "list-like structure check": "List-like sentences",
  "支线停滞": "Subplot stall",
  "subplot stagnation check": "Subplot stall",
  "弧线平坦": "Emotional arc",
  "arc flatline check": "Emotional arc",
  "节奏单调": "Pacing monotony",
  "pacing monotony": "Pacing monotony",
  "pacing monotony check": "Pacing monotony",
  "敏感词检查": "Sensitive wording",
  "sensitive content check": "Sensitive wording",
  "敏感词": "Sensitive wording",
  "sensitive terms": "Sensitive wording",
  "正传事件冲突": "Canon clash",
  "mainline canon event conflict": "Canon clash",
  "未来信息泄露": "Future knowledge",
  "future knowledge leak check": "Future knowledge",
  "世界规则跨书一致性": "World rules",
  "cross-book world rule check": "World rules",
  "番外伏笔隔离": "Spinoff thread",
  "spinoff hook isolation check": "Spinoff thread",
  "读者期待管理": "Reader expectation",
  "reader expectation check": "Reader expectation",
  "章节备忘偏离": "Did this chapter land",
  "chapter memo drift": "Did this chapter land",
  "chapter memo drift check": "Did this chapter land",
  "角色还原度": "Character fidelity",
  "character fidelity check": "Character fidelity",
  "世界规则遵守": "World rules",
  "world rule compliance check": "World rules",
  "关系动态": "Relationships",
  "relationship dynamics check": "Relationships",
  "正典事件一致性": "Canon events",
  "canon event consistency check": "Canon events",
  "hook 账需语义复核": "Did this thread land",
  "伏笔是否写到": "Did this thread land",
  "hook 账揭 1 埋 1 违规": "Close one, plant one",
  "揭一埋一": "Close one, plant one",
  "paragraph-shape": "Choppy paragraphs",
  "paragraph fragmentation": "Choppy paragraphs",
  "consecutive short paragraphs": "Choppy paragraphs",
  "paragraph density drift": "Choppy paragraphs",
  "段落过碎": "Choppy paragraphs",
  "连续短段": "Choppy paragraphs",
  "段落密度漂移": "Choppy paragraphs",
  "段落过长": "Long paragraphs",
  "paragraph length": "Long paragraphs",
  "title-dedup": "Chapter title",
  "标题重复": "Chapter title",
  "title collapse": "Chapter title",
  "length-budget": "Chapter length",
  "hook-debt": "Overdue thread",
  "hook debt": "Overdue thread",
  "伏笔债务": "Overdue thread",
  "伏笔逾期": "Overdue thread",
  "state-validation": "Continuity",
  "state-conflict": "Continuity",
  "audit": "Review",
  "review": "Review",
  "未分类": "Review",
  uncategorized: "Review",
  "系统错误": "Review",
  "system error": "Review",
  "模型审稿判断": "Review",
  "禁止句式": "Sentence pattern",
  "禁止破折号": "Punctuation",
  "报告术语": "Wording",
  "章节号指称": "Chapter number",
  "chapter-number-reference": "Chapter number",
  "本书禁忌": "Book rule",
  "book prohibition": "Book rule",
  "叙事人称": "Point of view",
  "作者说教": "Sermonizing",
  "集体反应": "Crowd reaction",
  "连续了字": "Too many 了",
  "元叙事": "Narrator aside",
  "高疲劳词": "Word habits",
  "转折词密度": "Word habits",
  "跨章重复": "Repeated phrasing",
  "cross-chapter repetition": "Repeated phrasing",
  "ai-tell word density": "Word habits",
  "fatigue word": "Word habits",
  "dialogue pressure": "Dialogue",
  "情绪单调": "Mood monotony",
  "mood monotony": "Mood monotony",
  "开头同构": "Opening pattern",
  "结尾同构": "Ending pattern",
  "opening pattern repetition": "Opening pattern",
  "ending pattern repetition": "Ending pattern",
  "aigc检测": "Generated texture",
};

const TEXT_REPLACEMENTS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly zh: string;
  readonly en: string;
}> = [
  { pattern: /\bPolisher\b/gi, zh: "文笔润色", en: "the prose pass" },
  { pattern: /\badvance\/resolve\b/gi, zh: "本章要推进或收束的伏笔", en: "threads this chapter meant to move or close" },
  { pattern: /hook\s*账/gi, zh: "伏笔", en: "planted thread" },
  { pattern: /\bparagraph-shape\b/gi, zh: "段落太碎", en: "choppy paragraphs" },
  { pattern: /\bhook-debt\b/gi, zh: "伏笔逾期", en: "overdue thread" },
  { pattern: /\blength-budget\b/gi, zh: "章节字数", en: "chapter length" },
  { pattern: /\btitle-dedup\b/gi, zh: "章节标题", en: "chapter title" },
  { pattern: /确定性关键词检查/g, zh: "对照正文", en: "a pass through the prose" },
  { pattern: /没有找到对应落点/g, zh: "还没看到对应的场面", en: "never lands on the page" },
  { pattern: /AI\s*标记词密度检查/g, zh: "用词习惯", en: "word habits" },
  { pattern: /密度低于每\d+字\d+次的阈值上限/g, zh: "用得并不勤", en: "does not show up often" },
  { pattern: /属健康区间/g, zh: "还算克制", en: "looks restrained" },
  { pattern: /不计入结构评分/g, zh: "不影响本章能不能过", en: "does not decide whether the chapter passes" },
  { pattern: /仅作记录供[^，。]{0,12}参考/g, zh: "记下给后边润色时看着", en: "noted for the later prose pass" },
  { pattern: /供\s*(?:Polisher|文笔润色)\s*参考/gi, zh: "给后边润色时看着", en: "for the later prose pass" },
  { pattern: /交由\s*(?:Polisher|文笔润色)\s*处理/gi, zh: "交给后边润色时再改", en: "leave this for the later prose pass" },
  { pattern: /\bPRE_WRITE_CHECK\b/g, zh: "写作前自检", en: "the pre-write check" },
  { pattern: /\bpending_hooks\.md\b/gi, zh: "伏笔清单", en: "the thread list" },
  { pattern: /\bvolume_map\b/gi, zh: "卷纲", en: "the volume map" },
  { pattern: /变异系数仅[\d.]+（阈值[<＜][\d.]+）/g, zh: "篇幅几乎一样长", en: "almost the same length" },
  { pattern: /密度为[\d.]+次\/千字（阈值[>][\d.]+）/g, zh: "用得偏多", en: "shows up too often" },
];

const HEALTHY_SIGNAL = /属健康区间|healthy range|仅作记录|log only/i;
const HEALTHY_CONTEXT = /阈值|密度|Polisher|参考|does not count|for the later prose|供\s/i;

export function inferReviewCopyLanguage(text: string): ReviewCopyLanguage {
  return /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
}

export function normalizeReviewCategoryKey(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[:：].*$/, "")
    .replace(/(?:检查|check)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapReviewCategory(category: string, language: ReviewCopyLanguage = "zh"): string {
  const raw = category.trim();
  if (!raw) return language === "en" ? "Review" : "审稿";

  const candidates = [
    raw.toLowerCase(),
    normalizeReviewCategoryKey(raw),
    raw.replace(/[:：].*$/, "").trim().toLowerCase(),
  ];
  const table = language === "en" ? CATEGORY_EN : CATEGORY_ZH;
  for (const key of candidates) {
    if (table[key]) return table[key]!;
  }

  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(normalizeReviewCategoryKey(raw))) {
    return language === "en" ? "Review" : "审稿";
  }

  const stripped = raw.replace(/[:：].*$/, "").trim();
  return stripped || (language === "en" ? "Review" : "审稿");
}

export function humanizeReviewText(text: string, language?: ReviewCopyLanguage): string {
  const resolved = language ?? inferReviewCopyLanguage(text);
  let next = text;
  for (const rule of TEXT_REPLACEMENTS) {
    next = next.replace(rule.pattern, resolved === "en" ? rule.en : rule.zh);
  }
  next = next
    .replace(/\bmemo\b/gi, resolved === "en" ? "the chapter plan" : "本章计划")
    .replace(/\s{2,}/g, " ")
    .replace(/[，、]{2,}/g, "，")
    .trim();
  return next;
}

export function isHealthyReviewNoise(issue: Pick<ReviewCopyIssue, "description"> & { readonly severity?: string }): boolean {
  const text = issue.description ?? "";
  return HEALTHY_SIGNAL.test(text) && HEALTHY_CONTEXT.test(text);
}

export function toAuthorFacingReviewIssue<T extends ReviewCopyIssue>(
  issue: T,
  language?: ReviewCopyLanguage,
): T | null {
  if (isHealthyReviewNoise(issue)) return null;
  const resolved = language ?? inferReviewCopyLanguage(`${issue.category} ${issue.description}`);
  return {
    ...issue,
    category: mapReviewCategory(issue.category, resolved),
    description: humanizeReviewText(issue.description, resolved),
    ...(issue.suggestion ? { suggestion: humanizeReviewText(issue.suggestion, resolved) } : {}),
  };
}

const AUTHOR_JARGON = /Polisher|paragraph-shape|advance\/resolve|hook\s*账|hook-debt|length-budget|title-dedup|确定性关键词|AI 标记词密度|PRE_WRITE_CHECK/i;

export function reviewCopyHasAuthorJargon(text: string): boolean {
  return AUTHOR_JARGON.test(text);
}
