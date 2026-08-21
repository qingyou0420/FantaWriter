import { formatLoreBlock, selectLoreForPrompt } from "./lore";
import type {
  Character,
  NovelProject,
  OutlineChapter,
  PlotThread,
  Volume,
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
  volumeMemory: string;
  /** 合并后的提示块，可直接拼进 prior context */
  priorBlock: string;
}

function sortOutline(
  chapters: OutlineChapter[] | undefined
): OutlineChapter[] {
  return [...(chapters || [])].sort((a, b) => a.order - b.order);
}

function sortVolumes(volumes?: Volume[]): Volume[] {
  return [...(volumes || [])].sort((a, b) => a.order - b.order);
}

/** 本卷主题 + 已完成卷的一句话总结 */
export function formatVolumeMemory(
  volumes: Volume[] | undefined,
  current?: OutlineChapter
): string {
  const vols = sortVolumes(volumes).filter((v) => v.summary?.trim());
  if (!vols.length) return "";
  const currentVol = current?.volumeId
    ? vols.find((v) => v.id === current.volumeId) ||
      sortVolumes(volumes).find((v) => v.id === current.volumeId)
    : undefined;
  const lines: string[] = [];
  if (currentVol) {
    lines.push(
      `本卷《${currentVol.title}》：${(currentVol.summary || "").trim() || "（未填摘要）"}`
    );
    const done = sortVolumes(volumes).filter(
      (v) => v.order < currentVol.order && v.summary?.trim()
    );
    if (done.length) {
      lines.push("已完成卷：");
      for (const v of done) {
        lines.push(`- 《${v.title}》：${v.summary.trim()}`);
      }
    }
  } else {
    lines.push("分卷主题：");
    for (const v of vols) {
      lines.push(`- 《${v.title}》：${v.summary.trim()}`);
    }
  }
  return lines.join("\n");
}

/**
 * 角色状态卡：只保留近期情节线索，不再重复人物静态字段。
 * 未选 cast 时仍用全部近期摘要；有 cast 时摘要不变（摘要是章级的）。
 */
export function buildCharacterStateCard(
  characters: Character[],
  recentSummaries: string[]
): string {
  const recent = recentSummaries.filter(Boolean).join("\n");
  if (!recent) return "";
  const names = characters
    .map((c) => c.name)
    .filter(Boolean)
    .slice(0, 12);
  const who = names.length ? `（关注：${names.join("、")}）` : "";
  return [
    `【角色状态卡 — 近期状态线索${who}】`,
    "请延续下列状态，勿无故重置称呼、伤势、关系与情绪。",
    recent,
  ].join("\n");
}

/**
 * 组装跨章记忆包
 * @param currentOrder 当前章 order（不含本章）
 */
export function buildMemoryPack(
  project: Pick<
    NovelProject,
    "characters" | "outline" | "chapters" | "plotThreads" | "lore" | "volumes"
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

  const current = outlineChs.find((c) => c.order === currentOrder);
  const castIds = (current?.castIds || []).filter(Boolean);
  const castChars = castIds.length
    ? (project.characters || []).filter((c) => castIds.includes(c.id))
    : project.characters || [];

  const characterStateCard = buildCharacterStateCard(
    castChars,
    rawSummaries.slice(-3)
  );

  const plotThreads = formatPlotThreads(project.plotThreads);
  const previousSummaries = summaryLines.join("\n");

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
  const volumeMemory = formatVolumeMemory(project.volumes, current);

  const priorParts: string[] = [];
  if (volumeMemory) {
    priorParts.push(`## 分卷记忆\n${volumeMemory}`);
  }
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
    volumeMemory,
    priorBlock: priorParts.join("\n\n"),
  };
}

/** 活跃伏笔简表（供 UI / 调试） */
export function listOpenThreads(threads?: PlotThread[]): PlotThread[] {
  return (threads || []).filter((t) => t.status !== "resolved");
}
