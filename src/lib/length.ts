import {
  LENGTH_RANGES,
  type ChapterLength,
  type GenerationSettings,
} from "./types";

/** 与阅读器字数统计一致：去空白后的字数 */
export function countChapterChars(text: string): number {
  return (text || "").replace(/\s/g, "").length;
}

export function lengthRangeFor(
  length: ChapterLength | string | undefined,
  custom?: { min: number; max: number } | null
): { min: number; max: number } {
  if (
    custom &&
    typeof custom.min === "number" &&
    typeof custom.max === "number" &&
    custom.min < custom.max
  ) {
    return { min: custom.min, max: custom.max };
  }
  if (length && length in LENGTH_RANGES) {
    return LENGTH_RANGES[length as ChapterLength];
  }
  return LENGTH_RANGES.medium;
}

export function chapterBelowMin(
  text: string,
  length: ChapterLength | string | undefined,
  custom?: { min: number; max: number } | null
): boolean {
  return countChapterChars(text) < lengthRangeFor(length, custom).min;
}

/** 写入「正文要求」的硬性篇幅条款 */
export function chapterLengthRequirement(
  length: ChapterLength | string | undefined,
  custom?: { min: number; max: number } | null
): string {
  const { min, max } = lengthRangeFor(length, custom);
  return [
    `本章目标篇幅为 ${min}–${max} 字（硬性，按去空白字数计）。`,
    `必须写满至少 ${min} 字再停笔；禁止在 ${min} 字之前收束、总结或写「本章完」。`,
    `把关键点逐条展开为场面，不要只交代结果。`,
  ].join("");
}

export function continueLengthRequirement(
  settings: Pick<GenerationSettings, "length" | "customLength">,
  existingChars?: number
): string {
  const { min, max } = lengthRangeFor(settings.length, settings.customLength);
  if (typeof existingChars === "number" && existingChars < min) {
    const remain = min - existingChars;
    return `已有正文约 ${existingChars} 字，未达本章下限 ${min} 字。本次续写至少 ${remain} 字，合计达到 ${min}–${max} 字；禁止总结式收尾。`;
  }
  return `续写跟随本书篇幅档：本章目标 ${min}–${max} 字。本次至少写到该档下限的一半（不少于 ${Math.max(400, Math.floor(min / 2))} 字），不要写完一小段就停。`;
}

export function expandTargetChars(
  selectedChars: number,
  scale: number
): number {
  const n = typeof scale === "number" ? scale : Number(scale);
  const s = Number.isFinite(n) && n > 1 ? n : 1.5;
  return Math.max(selectedChars + 80, Math.round(selectedChars * s));
}
