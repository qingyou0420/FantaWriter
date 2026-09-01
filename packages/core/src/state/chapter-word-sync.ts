import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BookConfig } from "../models/book.js";
import type { ChapterMeta } from "../models/chapter.js";
import type { LengthCountingMode } from "../models/length-governance.js";
import { countChapterLength, resolveLengthCountingMode } from "../utils/length-metrics.js";

export interface ChapterWordSyncDeps {
  bookDir(bookId: string): string;
  loadBookConfig(bookId: string): Promise<BookConfig>;
  loadChapterIndex(bookId: string): Promise<ReadonlyArray<ChapterMeta>>;
  saveChapterIndex(bookId: string, index: ReadonlyArray<ChapterMeta>): Promise<void>;
}

export interface ChapterWordCountChange {
  readonly number: number;
  readonly title: string;
  readonly previousWordCount: number;
  readonly wordCount: number;
}

export interface ChapterWordSyncResult {
  readonly bookId: string;
  readonly countingMode: LengthCountingMode;
  readonly checkedChapters: number;
  readonly changes: ReadonlyArray<ChapterWordCountChange>;
  /** Index entries whose chapter markdown file is missing on disk (left untouched). */
  readonly missingChapterFiles: ReadonlyArray<number>;
}

/**
 * Recount every indexed chapter from its markdown file and write corrected
 * word counts back to chapters/index.json. Used to realign the index after
 * chapter files were edited outside the pipeline (e.g. by hand).
 */
export async function syncChapterWordCounts(
  deps: ChapterWordSyncDeps,
  bookId: string,
): Promise<ChapterWordSyncResult> {
  const book = await deps.loadBookConfig(bookId);
  const countingMode = resolveLengthCountingMode(book.language);
  const index = await deps.loadChapterIndex(bookId);
  if (index.length === 0) {
    return { bookId, countingMode, checkedChapters: 0, changes: [], missingChapterFiles: [] };
  }

  const chaptersDir = join(deps.bookDir(bookId), "chapters");
  const fileByNumber = new Map<number, string>();
  for (const entry of await readdir(chaptersDir)) {
    const match = entry.match(/^(\d+)[_-]?.*\.md$/);
    if (!match) continue;
    const number = parseInt(match[1]!, 10);
    if (!fileByNumber.has(number)) fileByNumber.set(number, entry);
  }

  const now = new Date().toISOString();
  const changes: ChapterWordCountChange[] = [];
  const missingChapterFiles: number[] = [];
  const nextIndex: ChapterMeta[] = [];
  for (const chapter of index) {
    const fileName = fileByNumber.get(chapter.number);
    if (!fileName) {
      missingChapterFiles.push(chapter.number);
      nextIndex.push(chapter);
      continue;
    }
    const content = await readFile(join(chaptersDir, fileName), "utf-8");
    const wordCount = countChapterLength(content, countingMode);
    if (wordCount === chapter.wordCount) {
      nextIndex.push(chapter);
      continue;
    }
    changes.push({
      number: chapter.number,
      title: chapter.title,
      previousWordCount: chapter.wordCount,
      wordCount,
    });
    nextIndex.push({ ...chapter, wordCount, updatedAt: now });
  }

  if (changes.length > 0) {
    await deps.saveChapterIndex(bookId, nextIndex);
  }

  return {
    bookId,
    countingMode,
    checkedChapters: index.length,
    changes,
    missingChapterFiles,
  };
}
