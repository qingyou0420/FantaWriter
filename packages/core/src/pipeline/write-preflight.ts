/**
 * G1 write-before gate: refuse write-next / draft unless the target chapter
 * has a volume_map entry, story_frame and author_intent are non-empty, and
 * the previous chapter is settled (or the author explicitly skips / 带病续写).
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readStoryFrame, readVolumeMap } from "../utils/outline-paths.js";
import { findVolumeMapEntry } from "../utils/volume-map-entry.js";
import type { ChapterStatus } from "../models/chapter.js";

export type WritePreflightReasonCode =
  | "missing_volume_map_entry"
  | "empty_story_frame"
  | "empty_author_intent"
  | "previous_chapter_not_approved";

export type WritePreflightJump = "outline" | "intent" | "review";

export interface WritePreflightReason {
  readonly code: WritePreflightReasonCode;
  readonly message: string;
  readonly messageZh: string;
  readonly jumpTo: WritePreflightJump;
  readonly chapterNumber?: number;
}

export interface WritePreflightEvaluation {
  readonly ok: boolean;
  readonly chapterNumber: number;
  readonly reasons: ReadonlyArray<WritePreflightReason>;
  readonly message: string;
}

export interface EvaluateWritePreflightInput {
  readonly bookDir: string;
  readonly chapterNumber: number;
  readonly previousChapter?: {
    readonly number: number;
    readonly status: string;
  };
  readonly skipPreviousApproval?: boolean;
}

export class WritePreflightError extends Error {
  readonly code = "WRITE_PREFLIGHT";
  readonly chapterNumber: number;
  readonly reasons: ReadonlyArray<WritePreflightReason>;

  constructor(evaluation: WritePreflightEvaluation) {
    super(evaluation.message);
    this.name = "WritePreflightError";
    this.chapterNumber = evaluation.chapterNumber;
    this.reasons = evaluation.reasons;
  }
}

const SETTLED_PREVIOUS_STATUSES = new Set<ChapterStatus | string>([
  "approved",
  "published",
  "imported",
]);

const AUTHOR_INTENT_PLACEHOLDERS = [
  "（在这里描述这本书的长期创作方向。）",
  "(Describe the long-horizon vision for this book here.)",
];

export function isPreviousChapterSettled(status: string | undefined): boolean {
  if (!status) return false;
  return SETTLED_PREVIOUS_STATUSES.has(status);
}

export function isEmptyOrPlaceholderCanon(content: string, placeholders: ReadonlyArray<string> = []): boolean {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return true;
  const withoutHeading = trimmed.replace(/^#+\s+.+$/m, "").trim();
  if (!withoutHeading) return true;
  if (placeholders.some((marker) => withoutHeading.includes(marker)) && withoutHeading.length < 240) {
    return true;
  }
  return /^[（(][^）)]{0,80}[）)]$/.test(withoutHeading.replace(/\s+/g, ""));
}

export async function evaluateWritePreflight(
  input: EvaluateWritePreflightInput,
): Promise<WritePreflightEvaluation> {
  const reasons: WritePreflightReason[] = [];
  const [volumeMap, storyFrame, authorIntent] = await Promise.all([
    readVolumeMap(input.bookDir, ""),
    readStoryFrame(input.bookDir, ""),
    readFile(join(input.bookDir, "story", "author_intent.md"), "utf-8").catch(() => ""),
  ]);

  if (!findVolumeMapEntry(volumeMap, input.chapterNumber)) {
    reasons.push({
      code: "missing_volume_map_entry",
      message: `volume_map.md has no entry for chapter ${input.chapterNumber}.`,
      messageZh: `volume_map.md 没有第 ${input.chapterNumber} 章条目。请先排纲。`,
      jumpTo: "outline",
      chapterNumber: input.chapterNumber,
    });
  }

  if (isEmptyOrPlaceholderCanon(storyFrame)) {
    reasons.push({
      code: "empty_story_frame",
      message: "story_frame.md is empty or still a placeholder.",
      messageZh: "story_frame.md 为空或仍是占位。请先写骨架。",
      jumpTo: "outline",
    });
  }

  if (isEmptyOrPlaceholderCanon(authorIntent, AUTHOR_INTENT_PLACEHOLDERS)) {
    reasons.push({
      code: "empty_author_intent",
      message: "author_intent.md is empty or still a placeholder.",
      messageZh: "author_intent.md 为空或仍是占位。请先写作者意图。",
      jumpTo: "intent",
    });
  }

  if (input.chapterNumber > 1 && !input.skipPreviousApproval) {
    const previous = input.previousChapter;
    const previousNumber = previous?.number ?? input.chapterNumber - 1;
    if (!previous || previous.number !== input.chapterNumber - 1 || !isPreviousChapterSettled(previous.status)) {
      reasons.push({
        code: "previous_chapter_not_approved",
        message: `Chapter ${previousNumber} is not approved. Pass skipPreviousApproval to continue with 带病续写.`,
        messageZh: `上一章（第 ${previousNumber} 章）尚未通过。勾选「带病续写」才能继续。`,
        jumpTo: "review",
        chapterNumber: previousNumber,
      });
    }
  }

  const message = reasons.length === 0
    ? `Write preflight passed for chapter ${input.chapterNumber}.`
    : reasons.map((reason) => reason.message).join(" ");

  return {
    ok: reasons.length === 0,
    chapterNumber: input.chapterNumber,
    reasons,
    message,
  };
}

export function assertWritePreflight(evaluation: WritePreflightEvaluation): void {
  if (evaluation.ok) return;
  throw new WritePreflightError(evaluation);
}
