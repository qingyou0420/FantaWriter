import { formatLoreBlock, selectLoreForPrompt } from "./lore";
import type {
  Character,
  NovelProject,
  OutlineChapter,
  PlotThread,
} from "./types";

function formatPlotThreads(threads?: PlotThread[]): string {
  if (!threads?.length) return "";
  return threads
    .filter((t) => t.status !== "resolved")
    .map((t) => `- [${t.status}] ${t.title}${t.note ? `：${t.note}` : ""}`)
    .join("\n");
}

/** 跨章记忆包：生成章前注入，减漂移 */
export interface MemoryPack {
  previousSummaries: string;
  previousSnippet?: string;
  characterStateCard: string;
  plotThreads: string;
  lore: string;
  /** 合并后的提示块，可直接拼进 prior context */
  priorBlock: string;
}

function sortOutline(
  chapters: OutlineChapter[] | undefined
): OutlineChapter[] {
  return [...(chapters || [])].sort((a, b) => a.order - b.order);
}

/** 角色状态卡：设定摘要 + 近期章节摘要中的痕迹 */
export function buildCharacterStateCard(
  characters: Character[],
  recentSummaries: string[]
): string {
  if (!characters.length) return "";

  const lines = characters.map((c, i) => {
    const bits = [
      c.name || "未命名",
      c.role && `定位:${c.role}`,
      c.gender && `性别:${c.gender}`,
      c.age && `年龄:${c.age}`,
      c.personality && `性格:${c.personality.slice(0, 80)}`,
      c.relationships && `关系:${c.relationships.slice(0, 100)}`,
      c.notes && `备注:${c.notes.slice(0, 80)}`,
    ].filter(Boolean);
    return `${i + 1}. ${bits.join(" · ")}`;
  });

  const recent = recentSummaries.filter(Boolean).join("\n");
  const parts = [
    "【角色状态卡 — 本章须保持称呼、性格、关系一致】",
    ...lines,
  ];
  if (recent) {
    parts.push(
      "",
      "【近期情节中的状态线索（请延续，勿无故重置）】",
      recent
    );
  }
  return parts.join("\n");
}

/**
 * 组装跨章记忆包
 * @param currentOrder 当前章 order（不含本章）
 */
export function buildMemoryPack(
  project: Pick<
    NovelProject,
    "characters" | "outline" | "chapters" | "plotThreads" | "lore"
  >,
  currentOrder: number,
  opts?: { summaryLimit?: number; snippetChars?: number; chapterText?: string }
): MemoryPack {
  const summaryLimit = opts?.summaryLimit ?? 5;
  const snippetChars = opts?.snippetChars ?? 1000;
  const outlineChs = sortOutline(project.outline?.chapters);
  const prev = outlineChs.filter((c) => c.order < currentOrder);

  const summaryLines: string[] = [];
  const rawSummaries: string[] = [];

  for (const ch of prev.slice(-summaryLimit)) {
    const row = project.chapters.find((c) => c.chapterId === ch.id);
    const aiSum = row?.summary?.trim();
    const fallback = (row?.content || "").replace(/\s+/g, " ").slice(0, 200);
    const outlineSum = ch.summary || "";
    const line = `第${ch.order}章《${ch.title}》：${aiSum || outlineSum || fallback || "（无）"}`;
    summaryLines.push(line);
    if (aiSum) rawSummaries.push(`第${ch.order}章：${aiSum}`);
    else if (outlineSum) rawSummaries.push(`第${ch.order}章：${outlineSum}`);
  }

  let previousSnippet: string | undefined;
  const last = prev[prev.length - 1];
  if (last) {
    const row = project.chapters.find((c) => c.chapterId === last.id);
    if (row?.content) previousSnippet = row.content.slice(-snippetChars);
  }

  const characterStateCard = buildCharacterStateCard(
    project.characters || [],
    rawSummaries.slice(-3)
  );

  const plotThreads = formatPlotThreads(project.plotThreads);
  const previousSummaries = summaryLines.join("\n");

  const current = outlineChs.find((c) => c.order === currentOrder);
  const currentRow = current
    ? project.chapters.find((c) => c.chapterId === current.id)
    : undefined;
  const chapterText =
    opts?.chapterText ||
    [
      current?.title,
      current?.summary,
      current?.keyPoints,
      currentRow?.content,
    ]
      .filter(Boolean)
      .join("\n");
  const loreEntries = selectLoreForPrompt(project, chapterText);
  const lore = formatLoreBlock(loreEntries);

  const priorParts: string[] = [];
  if (characterStateCard) {
    priorParts.push(`## 角色状态卡\n${characterStateCard}`);
  }
  if (previousSummaries) {
    priorParts.push(`## 前情摘要（前几章）\n${previousSummaries}`);
  }
  if (previousSnippet) {
    priorParts.push(`## 上一章结尾片段（衔接用）\n${previousSnippet}`);
  }
  if (plotThreads) {
    priorParts.push(`## 伏笔/线索（本章可推进或回收）\n${plotThreads}`);
  }
  if (lore) {
    priorParts.push(`## 世界观设定（关键词命中）\n${lore}`);
  }

  return {
    previousSummaries,
    previousSnippet,
    characterStateCard,
    plotThreads,
    lore,
    priorBlock: priorParts.join("\n\n"),
  };
}

/** 活跃伏笔简表（供 UI / 调试） */
export function listOpenThreads(threads?: PlotThread[]): PlotThread[] {
  return (threads || []).filter((t) => t.status !== "resolved");
}
