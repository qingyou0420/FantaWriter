/**
 * Parse volume_map.md into a 卷→章 tree and apply in-place edits.
 * G1 still requires a real chapter entry; this parser does not invent one.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type VolumeMapNodeKind = "volume" | "chapter" | "range";

export interface VolumeMapChapterNode {
  readonly kind: "chapter" | "range";
  readonly id: string;
  readonly chapterNumber: number;
  readonly endChapter?: number;
  readonly title: string;
  readonly summary: string;
  readonly lineStart: number;
  readonly lineEnd: number;
}

export interface VolumeMapVolumeNode {
  readonly kind: "volume";
  readonly id: string;
  readonly volumeNumber: number | null;
  readonly title: string;
  readonly okr: string;
  /** Full pre-chapter volume body (OKR + notes). Unedited lines stay in canon. */
  readonly body: string;
  readonly startChapter?: number;
  readonly endChapter?: number;
  readonly chapters: ReadonlyArray<VolumeMapChapterNode>;
  readonly lineStart: number;
  readonly lineEnd: number;
}

export interface VolumeMapTree {
  readonly volumes: ReadonlyArray<VolumeMapVolumeNode>;
  readonly orphanChapters: ReadonlyArray<VolumeMapChapterNode>;
  readonly chapterCount: number;
  readonly volumeCount: number;
}

const CN_DIGIT: Readonly<Record<string, number>> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const VOLUME_HEADER = /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?(第\s*([一二三四五六七八九十百千万零〇两\d]+)\s*卷|Volume\s+(\d+)|卷\s*([一二三四五六七八九十百\d]+))(?:\*\*)?/i;
const RANGE_ON_LINE = /[（(]\s*(?:第|[Cc]hapters?\s+)?(\d+)\s*[-–~～—]\s*(\d+)\s*(?:章)?\s*[）)]|(?:第|[Cc]hapters?\s+)(\d+)\s*[-–~～—]\s*(\d+)\s*(?:章)?/i;
const EXACT_CHAPTER = /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?(?:Chapter\s*(\d+)|第\s*(\d+)\s*章)(?!\s*[-~–—]\s*\d)(?:[:：-])?(?:\*\*)?\s*(.*)$/i;
const RANGE_CHAPTER = /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?(?:Chapter\s*(\d+)\s*[-~–—]\s*(\d+)|第\s*(\d+)\s*[-~–—]\s*(\d+)\s*章)(?:[:：-])?(?:\*\*)?\s*(.*)$/i;
const OKR_LINE = /(?:Objective|Key\s*Results?|KR\s*\d+|卷级目标|关键成果|关键结果)/i;

export function parseChineseInt(raw: string): number | null {
  const trimmed = raw.replace(/\s+/g, "");
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (trimmed === "十") return 10;
  if (trimmed.startsWith("十")) {
    const rest = parseChineseInt(trimmed.slice(1));
    return rest == null ? null : 10 + rest;
  }
  const tenAt = trimmed.indexOf("十");
  if (tenAt >= 0) {
    const left = trimmed.slice(0, tenAt);
    const right = trimmed.slice(tenAt + 1);
    const hi = left ? CN_DIGIT[left] : 1;
    const lo = right ? (CN_DIGIT[right] ?? parseChineseInt(right)) : 0;
    if (hi == null || lo == null) return null;
    return hi * 10 + lo;
  }
  return CN_DIGIT[trimmed] ?? null;
}

export function formatVolumeLabel(volumeNumber: number | null, title: string, isZh: boolean): string {
  const cleaned = title.replace(/^#+\s*/, "").trim() || title;
  if (cleaned) return cleaned;
  if (volumeNumber == null) return isZh ? "本卷" : "This volume";
  return isZh ? `第${volumeNumber}卷` : `Volume ${volumeNumber}`;
}

function stripDecor(line: string): string {
  return line.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/\*\*/g, "").trim();
}

function isVolumeHeader(line: string): RegExpMatchArray | null {
  const cleaned = stripDecor(line);
  return cleaned.match(VOLUME_HEADER);
}

function parseVolumeHeader(line: string): {
  volumeNumber: number | null;
  title: string;
  startChapter?: number;
  endChapter?: number;
} | null {
  const match = isVolumeHeader(line);
  if (!match) return null;
  const rawNumber = match[2] ?? match[3] ?? match[4] ?? "";
  const volumeNumber = parseChineseInt(rawNumber);
  const range = line.match(RANGE_ON_LINE);
  const startChapter = range ? Number.parseInt(range[1] ?? range[3] ?? "", 10) : undefined;
  const endChapter = range ? Number.parseInt(range[2] ?? range[4] ?? "", 10) : undefined;
  let title = stripDecor(line);
  if (range?.index != null) {
    title = stripDecor(line.slice(0, range.index)).replace(/[（(]\s*$/, "").trim();
  }
  title = title.replace(/[：:]\s*$/, "").trim();
  return {
    volumeNumber,
    title,
    startChapter: Number.isInteger(startChapter) ? startChapter : undefined,
    endChapter: Number.isInteger(endChapter) ? endChapter : undefined,
  };
}

function parseChapterLine(line: string): VolumeMapChapterNode | null {
  const range = line.match(RANGE_CHAPTER);
  if (range) {
    const start = Number.parseInt(range[1] ?? range[3] ?? "", 10);
    const end = Number.parseInt(range[2] ?? range[4] ?? "", 10);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    const title = (range[5] ?? "").trim();
    return {
      kind: "range",
      id: `range:${start}-${end}`,
      chapterNumber: Math.min(start, end),
      endChapter: Math.max(start, end),
      title,
      summary: "",
      lineStart: 0,
      lineEnd: 0,
    };
  }
  const exact = line.match(EXACT_CHAPTER);
  if (!exact) return null;
  const chapterNumber = Number.parseInt(exact[1] ?? exact[2] ?? "", 10);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return null;
  return {
    kind: "chapter",
    id: `chapter:${chapterNumber}`,
    chapterNumber,
    title: (exact[3] ?? "").trim(),
    summary: "",
    lineStart: 0,
    lineEnd: 0,
  };
}

function isStructuralLine(line: string): boolean {
  return Boolean(parseVolumeHeader(line) || parseChapterLine(line));
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const next = [...lines];
  while (next.length && next[next.length - 1].trim() === "") next.pop();
  return next;
}

function collectSummary(lines: ReadonlyArray<string>, start: number): { summary: string; end: number } {
  const collected: string[] = [];
  let end = start - 1;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (isStructuralLine(line)) break;
    collected.push(line);
    end = index;
  }
  while (collected.length && collected[collected.length - 1].trim() === "") {
    collected.pop();
    end -= 1;
  }
  while (collected.length && collected[0].trim() === "") collected.shift();
  return { summary: collected.join("\n"), end: end < start ? start - 1 : end };
}

function extractOkr(bodyLines: ReadonlyArray<string>): string {
  const okrLines = bodyLines.filter((line) => OKR_LINE.test(line));
  if (okrLines.length > 0) return okrLines.join("\n").trim();
  const prose = bodyLines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !isStructuralLine(line));
  return prose.slice(0, 3).join("\n").trim();
}

export function parseVolumeMapTree(markdown: string): VolumeMapTree {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const volumes: VolumeMapVolumeNode[] = [];
  const orphanChapters: VolumeMapChapterNode[] = [];

  type OpenVolume = {
    volumeNumber: number | null;
    title: string;
    startChapter?: number;
    endChapter?: number;
    lineStart: number;
    chapters: VolumeMapChapterNode[];
  };

  let current: OpenVolume | null = null;

  const flushVolume = (endLine: number) => {
    if (!current) return;
    const id = current.volumeNumber != null ? `volume:${current.volumeNumber}` : `volume:${current.lineStart}`;
    const firstChapterStart = current.chapters[0]?.lineStart;
    const bodyUntil = firstChapterStart ?? endLine + 1;
    const bodyLines = trimTrailingBlankLines(lines.slice(current.lineStart + 1, bodyUntil));
    volumes.push({
      kind: "volume",
      id,
      volumeNumber: current.volumeNumber,
      title: current.title,
      okr: extractOkr(bodyLines),
      body: bodyLines.join("\n"),
      startChapter: current.startChapter,
      endChapter: current.endChapter,
      chapters: current.chapters,
      lineStart: current.lineStart,
      lineEnd: Math.max(current.lineStart, endLine),
    });
    current = null;
  };

  const pushChapter = (node: VolumeMapChapterNode, lineIndex: number) => {
    const follow = collectSummary(lines, lineIndex + 1);
    const complete: VolumeMapChapterNode = {
      ...node,
      summary: node.title && !follow.summary ? "" : follow.summary,
      title: node.title,
      lineStart: lineIndex,
      lineEnd: follow.end >= lineIndex ? follow.end : lineIndex,
    };
    if (current) current.chapters.push(complete);
    else orphanChapters.push(complete);
    return complete.lineEnd;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const volume = parseVolumeHeader(line);
    if (volume) {
      flushVolume(index - 1);
      current = {
        ...volume,
        lineStart: index,
        chapters: [],
      };
      continue;
    }
    const chapter = parseChapterLine(line);
    if (chapter) {
      index = pushChapter(chapter, index);
    }
  }
  flushVolume(lines.length - 1);

  const chapterCount = [...volumes.flatMap((volume) => volume.chapters), ...orphanChapters].reduce((sum, node) => {
    if (node.kind === "range" && node.endChapter) return sum + (node.endChapter - node.chapterNumber + 1);
    return sum + 1;
  }, 0);

  return {
    volumes,
    orphanChapters,
    chapterCount,
    volumeCount: volumes.length,
  };
}

export function findChapterNode(
  tree: VolumeMapTree,
  chapterNumber: number,
): VolumeMapChapterNode | undefined {
  const nodes = [...tree.volumes.flatMap((volume) => volume.chapters), ...tree.orphanChapters];
  return nodes.find((node) => {
    if (node.kind === "range" && node.endChapter) {
      return chapterNumber >= node.chapterNumber && chapterNumber <= node.endChapter;
    }
    return node.chapterNumber === chapterNumber;
  });
}

export function findVolumeForChapter(
  tree: VolumeMapTree,
  chapterNumber: number,
): VolumeMapVolumeNode | undefined {
  for (const volume of tree.volumes) {
    if (volume.chapters.some((node) => {
      if (node.kind === "range" && node.endChapter) {
        return chapterNumber >= node.chapterNumber && chapterNumber <= node.endChapter;
      }
      return node.chapterNumber === chapterNumber;
    })) {
      return volume;
    }
    if (
      volume.startChapter != null
      && volume.endChapter != null
      && chapterNumber >= volume.startChapter
      && chapterNumber <= volume.endChapter
    ) {
      return volume;
    }
  }
  return tree.volumes[0];
}

export function recommendedOutlineNodeId(tree: VolumeMapTree, nextChapter: number): string | null {
  const chapter = findChapterNode(tree, nextChapter);
  if (chapter) return chapter.id;
  const volume = findVolumeForChapter(tree, nextChapter);
  if (volume) return volume.id;
  return tree.volumes[0]?.id ?? tree.orphanChapters[0]?.id ?? null;
}

export function findNodeById(
  tree: VolumeMapTree,
  nodeId: string,
): VolumeMapVolumeNode | VolumeMapChapterNode | undefined {
  return tree.volumes.find((volume) => volume.id === nodeId)
    ?? tree.volumes.flatMap((volume) => volume.chapters).find((node) => node.id === nodeId)
    ?? tree.orphanChapters.find((node) => node.id === nodeId);
}

function replaceLineRange(
  markdown: string,
  start: number,
  end: number,
  replacement: ReadonlyArray<string>,
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const next = [...lines.slice(0, start), ...replacement, ...lines.slice(end + 1)];
  return next.join("\n");
}

function chapterHeading(node: VolumeMapChapterNode, title: string): string {
  if (node.kind === "range" && node.endChapter) {
    return `## 第 ${node.chapterNumber}-${node.endChapter} 章 ${title}`.trim();
  }
  return `## 第 ${node.chapterNumber} 章 ${title}`.trim();
}

function replaceVolumeHeadingTitle(
  oldHeading: string,
  newTitle: string,
  node: VolumeMapVolumeNode,
): string {
  const hash = oldHeading.match(/^#+/)?.[0] ?? "##";
  const rangeOnLine = oldHeading.match(/[（(]\s*(?:第|[Cc]hapters?\s+)?\d+\s*[-–~～—]\s*\d+\s*(?:章)?\s*[）)]/);
  if (rangeOnLine) return `${hash} ${newTitle}${rangeOnLine[0]}`;
  const range = node.startChapter && node.endChapter
    ? `（${node.startChapter}-${node.endChapter}章）`
    : "";
  return `${hash} ${newTitle}${range}`;
}

function replaceChapterHeadingTitle(
  oldHeading: string,
  node: VolumeMapChapterNode,
  newTitle: string,
): string {
  const rangePrefix = oldHeading.match(/^(#{1,3})\s*(第\s*\d+\s*[-–~～—]\s*\d+\s*章)\s*/);
  if (rangePrefix) return `${rangePrefix[1]} ${rangePrefix[2]} ${newTitle}`.trim();
  const zhPrefix = oldHeading.match(/^(#{1,3})\s*(第\s*\d+\s*章)\s*/);
  if (zhPrefix) return `${zhPrefix[1]} ${zhPrefix[2]} ${newTitle}`.trim();
  const enPrefix = oldHeading.match(/^(#{1,3})\s*(Chapter\s*\d+(?:\s*[-–~～—]\s*\d+)?)\s*/i);
  if (enPrefix) return `${enPrefix[1]} ${enPrefix[2]} ${newTitle}`.trim();
  return chapterHeading(node, newTitle);
}

export function outlineEditorSource(
  node: VolumeMapVolumeNode | VolumeMapChapterNode,
): { title: string; summary: string } {
  return {
    title: node.title,
    summary: node.kind === "volume" ? node.body : node.summary,
  };
}

/**
 * Only persist fields the user actually changed. Select+blur with an
 * unchanged title/summary must not rewrite volume_map (G2).
 */
export function buildOutlineEditPatch(
  node: VolumeMapVolumeNode | VolumeMapChapterNode,
  title: string,
  summary: string,
): { readonly title?: string; readonly summary?: string } | null {
  const source = outlineEditorSource(node);
  const patch: { title?: string; summary?: string } = {};
  if (title.trim() !== source.title.trim()) patch.title = title.trim();
  if (summary !== source.summary) patch.summary = summary;
  return patch.title !== undefined || patch.summary !== undefined ? patch : null;
}

/** Outline workspace save: no-op when the draft matches the selected node. */
export function applyOutlineWorkspaceSave(
  markdown: string,
  nodeId: string,
  title: string,
  summary: string,
): string {
  const tree = parseVolumeMapTree(markdown);
  const node = findNodeById(tree, nodeId);
  if (!node) return markdown;
  const patch = buildOutlineEditPatch(node, title, summary);
  if (!patch) return markdown;
  return applyVolumeMapNodeEdit(markdown, nodeId, patch);
}

/**
 * In-place volume_map edits stay lossless for unedited lines: title-only
 * touches the heading; a volume summary replaces only the pre-chapter body
 * and leaves chapter blocks verbatim (including multi-paragraph summaries).
 */
export function applyVolumeMapNodeEdit(
  markdown: string,
  nodeId: string,
  patch: { readonly title?: string; readonly summary?: string },
): string {
  const tree = parseVolumeMapTree(markdown);
  const node = findNodeById(tree, nodeId);
  if (!node) return markdown;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  if (node.kind === "volume") {
    const oldHeading = lines[node.lineStart] ?? "";
    const nextHeader = patch.title !== undefined
      ? replaceVolumeHeadingTitle(oldHeading, patch.title, node)
      : oldHeading;
    if (patch.summary === undefined) {
      return replaceLineRange(markdown, node.lineStart, node.lineStart, [nextHeader]);
    }
    const firstChapterStart = node.chapters[0]?.lineStart;
    const bodyUntil = firstChapterStart ?? node.lineEnd + 1;
    return [...lines.slice(0, node.lineStart), nextHeader, ...patch.summary.split("\n"), ...lines.slice(bodyUntil)].join("\n");
  }

  const oldHeading = lines[node.lineStart] ?? "";
  const nextHeading = patch.title !== undefined
    ? replaceChapterHeadingTitle(oldHeading, node, patch.title)
    : oldHeading;
  if (patch.summary === undefined) {
    return replaceLineRange(markdown, node.lineStart, node.lineStart, [nextHeading]);
  }
  return [
    ...lines.slice(0, node.lineStart),
    nextHeading,
    ...patch.summary.split("\n"),
    ...lines.slice(node.lineEnd + 1),
  ].join("\n");
}

export function insertChapterStub(
  markdown: string,
  chapterNumber: number,
  volumeId?: string,
): string {
  const stub = `\n\n## 第 ${chapterNumber} 章\n`;
  if (!volumeId) return `${markdown.replace(/\s+$/, "")}${stub}`;
  const tree = parseVolumeMapTree(markdown);
  const volume = tree.volumes.find((item) => item.id === volumeId);
  if (!volume) return `${markdown.replace(/\s+$/, "")}${stub}`;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const insertAt = volume.lineEnd + 1;
  return [...lines.slice(0, insertAt), "", `## 第 ${chapterNumber} 章`, "", ...lines.slice(insertAt)].join("\n");
}

export function volumeContainsChapter(volume: VolumeMapVolumeNode, chapterNumber: number): boolean {
  if (volume.startChapter != null && volume.endChapter != null) {
    return chapterNumber >= volume.startChapter && chapterNumber <= volume.endChapter;
  }
  return volume.chapters.some((node) => {
    if (node.kind === "range" && node.endChapter) {
      return chapterNumber >= node.chapterNumber && chapterNumber <= node.endChapter;
    }
    return node.chapterNumber === chapterNumber;
  });
}

export function plannedChapterCount(volume: VolumeMapVolumeNode): number | null {
  if (volume.startChapter != null && volume.endChapter != null) {
    return volume.endChapter - volume.startChapter + 1;
  }
  if (volume.chapters.length === 0) return null;
  return volume.chapters.reduce((sum, node) => {
    if (node.kind === "range" && node.endChapter) return sum + (node.endChapter - node.chapterNumber + 1);
    return sum + 1;
  }, 0);
}

export function lastPlannedChapter(volume: VolumeMapVolumeNode): number | undefined {
  if (volume.endChapter != null) return volume.endChapter;
  const numbers = volume.chapters.map((node) => node.endChapter ?? node.chapterNumber);
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
}
