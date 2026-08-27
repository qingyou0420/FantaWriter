import { chapterBelowMin, countChapterChars, lengthRangeFor } from "./length";
import { detectCanonViolations } from "./original";
import type {
  GenerationSettings,
  LockedCanonFact,
  OriginalManuscript,
} from "./types";

export type OutlineCheckResult = {
  covered: string[];
  missing: string[];
  extra: string[];
  score: number;
  advice: string;
};

export type ChapterHealth = {
  outline: OutlineCheckResult | null;
  length: {
    chars: number;
    min: number;
    max: number;
    ok: boolean;
  };
  canon: {
    violations: string[];
    ok: boolean;
  };
  summary: {
    present: boolean;
  };
};

export function buildChapterHealth(opts: {
  outlineCheck?: OutlineCheckResult | null;
  content: string;
  settings: Pick<GenerationSettings, "length" | "customLength">;
  canon?: LockedCanonFact[] | null;
  original?: OriginalManuscript | null;
  summary?: string;
}): ChapterHealth {
  const range = lengthRangeFor(opts.settings.length, opts.settings.customLength);
  const chars = countChapterChars(opts.content);
  const violations = detectCanonViolations(opts.content, opts.canon);
  return {
    outline: opts.outlineCheck || null,
    length: {
      chars,
      min: range.min,
      max: range.max,
      ok: !chapterBelowMin(
        opts.content,
        opts.settings.length,
        opts.settings.customLength
      ) && chars > 0,
    },
    canon: {
      violations,
      ok: violations.length === 0,
    },
    summary: {
      present: Boolean(opts.summary?.trim()),
    },
  };
}
