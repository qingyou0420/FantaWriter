/**
 * Locate a chapter entry in volume_map.md / volume_outline.md.
 * Exact "第 N 章" / "Chapter N" lines and inclusive ranges count.
 * First-directive fallback used by the planner is intentionally not applied —
 * G1 requires a real outline node for the target chapter.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function findVolumeMapEntry(
  volumeMap: string,
  chapterNumber: number,
): string | undefined {
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) return undefined;
  const lines = volumeMap.split("\n").map((line) => line.trim()).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const exact = matchExactOutlineLine(line, chapterNumber);
    if (!exact) continue;
    const inline = cleanOutlineContent(exact[1]);
    if (inline) return inline;
    const next = findNextOutlineContent(lines, index + 1);
    if (next) return next;
    return line;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const range = matchRangeOutlineLine(line, chapterNumber);
    if (!range) continue;
    const inline = cleanOutlineContent(range[3]);
    if (inline) return inline;
    const next = findNextOutlineContent(lines, index + 1);
    if (next) return next;
    return line;
  }

  return undefined;
}

function cleanOutlineContent(content?: string): string | undefined {
  const cleaned = content?.trim();
  if (!cleaned) return undefined;
  if (/^[*_`~:：-]+$/.test(cleaned)) return undefined;
  return cleaned;
}

function findNextOutlineContent(lines: ReadonlyArray<string>, startIndex: number): string | undefined {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line) continue;
    if (matchAnyExactOutlineLine(line) || matchAnyRangeOutlineLine(line)) return undefined;
    if (line.startsWith("#")) continue;
    const cleaned = cleanOutlineContent(line);
    if (cleaned) return cleaned;
  }
  return undefined;
}

function matchExactOutlineLine(line: string, chapterNumber: number): RegExpMatchArray | undefined {
  const patterns = [
    new RegExp(`^(?:#+\\s*)?(?:[-*]\\s+)?(?:\\*\\*)?Chapter\\s*${chapterNumber}(?!\\d|\\s*[-~–—]\\s*\\d)(?:[:：-])?(?:\\*\\*)?\\s*(.*)$`, "i"),
    new RegExp(`^(?:#+\\s*)?(?:[-*]\\s+)?(?:\\*\\*)?第\\s*${chapterNumber}\\s*章(?!\\d|\\s*[-~–—]\\s*\\d)(?:[:：-])?(?:\\*\\*)?\\s*(.*)$`),
  ];
  return patterns.map((pattern) => line.match(pattern)).find((result): result is RegExpMatchArray => Boolean(result));
}

function matchAnyExactOutlineLine(line: string): RegExpMatchArray | undefined {
  const patterns = [
    /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?Chapter\s*\d+(?!\s*[-~–—]\s*\d)(?:[:：-])?(?:\*\*)?\s*(.*)$/i,
    /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?第\s*\d+\s*章(?!\s*[-~–—]\s*\d)(?:[:：-])?(?:\*\*)?\s*(.*)$/i,
  ];
  return patterns.map((pattern) => line.match(pattern)).find((result): result is RegExpMatchArray => Boolean(result));
}

function matchRangeOutlineLine(line: string, chapterNumber: number): RegExpMatchArray | undefined {
  const match = matchAnyRangeOutlineLine(line);
  if (!match) return undefined;
  const start = Number.parseInt(match[1] ?? "", 10);
  const end = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  if (chapterNumber < lower || chapterNumber > upper) return undefined;
  return match;
}

function matchAnyRangeOutlineLine(line: string): RegExpMatchArray | undefined {
  const patterns = [
    /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?Chapter\s*(\d+)\s*[-~–—]\s*(\d+)\b(?:[:：-])?(?:\*\*)?\s*(.*)$/i,
    /^(?:#+\s*)?(?:[-*]\s+)?(?:\*\*)?第\s*(\d+)\s*[-~–—]\s*(\d+)\s*章(?:[:：-])?(?:\*\*)?\s*(.*)$/i,
    /^(?:[-*]\s+)?(?:\*\*)?章节范围(?:\*\*)?[：:]\s*(\d+)\s*[-~–—]\s*(\d+)\s*章\s*(.*)$/,
    /^(?:[-*]\s+)?(?:\*\*)?Chapter\s*[Rr]ange(?:\*\*)?[：:]\s*(\d+)\s*[-~–—]\s*(\d+)\b\s*(.*)$/i,
  ];
  return patterns.map((pattern) => line.match(pattern)).find((result): result is RegExpMatchArray => Boolean(result));
}
