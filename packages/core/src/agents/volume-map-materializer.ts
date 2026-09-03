/**
 * Staged outline weaver: lock the volume split first, then fill 10 chapter
 * summaries per call. Never materialize a whole book in one LLM request.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { BaseAgent } from "./base.js";
import type { BookConfig } from "../models/book.js";
import type { TruthProposal } from "../interaction/truth-proposals.js";
import { isKimiK3Model } from "../llm/moonshot-sampling.js";
import { LLMStreamInactivityError } from "../llm/provider.js";
import {
  chapterNodesByNumber,
  leftoverVolumeMapProse,
  listedExactChapterNumbers,
  missingExactChapters,
  nextUnfilledChapterBatch,
  parseProseVolumeHints,
  parseVolumeMapTree,
  planVolumeRanges,
  planVolumeRangesFromHints,
  renderVolumeMapMarkdown,
  resolveOutlineWeaveStep,
  resolveTargetChapterCount,
  isPlaceholderVolumeTitle,
  type AssembledVolume,
  type AssembledVolumeChapter,
  type PlannedVolumeRange,
  type VolumeMapChapterNode,
} from "../utils/volume-map-tree.js";

export type VolumeMapMaterializeMode = "init" | "volumes" | "batch" | "remaining" | "full";
export type VolumeMapWeaveStep = "volumes" | "batch" | "done";

/** One reviewable batch. Never dump 40–260 chapters in a single weave POST. */
export const MAX_CHAPTERS_PER_CALL = 10;

/** First-event / idle stay tight; overall must outlast kimi-k3 thinking on a 10-chapter batch. */
export const MATERIALIZER_FIRST_EVENT_TIMEOUT_MS = 90_000;
export const MATERIALIZER_STREAM_IDLE_TIMEOUT_MS = 60_000;
/** 240s aborted a live 醉词 kimi-k3 batch that was still thinking. Match pipeline overall. */
export const MATERIALIZER_OVERALL_TIMEOUT_MS = 900_000;

export interface VolumeMapWeaveProgress {
  readonly phase: "start" | "volumes" | "batch" | "complete";
  readonly talkingToModel: boolean;
  readonly volumeNumber?: number;
  readonly volumeCount: number;
  readonly volumeTitle?: string;
  readonly chapterStart?: number;
  readonly chapterEnd?: number;
  readonly completedChapters: number;
  readonly targetChapters: number;
  readonly elapsedMs: number;
  readonly message: string;
}

export interface VolumeMapWeaveFailure {
  readonly volumeNumber?: number;
  readonly volumeCount: number;
  readonly volumeTitle?: string;
  readonly chapterStart?: number;
  readonly chapterEnd?: number;
  readonly completedVolumes: number;
  readonly completedChapters: number;
  readonly targetChapters: number;
  readonly generatedChapterNumbers: readonly number[];
  readonly partialMarkdown?: string;
}

export class VolumeMapWeaveError extends Error {
  readonly volumeNumber?: number;
  readonly volumeCount: number;
  readonly volumeTitle?: string;
  readonly chapterStart?: number;
  readonly chapterEnd?: number;
  readonly completedVolumes: number;
  readonly completedChapters: number;
  readonly targetChapters: number;
  readonly generatedChapterNumbers: readonly number[];
  readonly partialMarkdown?: string;
  proposal?: TruthProposal;

  constructor(message: string, failure: VolumeMapWeaveFailure) {
    super(message);
    this.name = "VolumeMapWeaveError";
    this.volumeNumber = failure.volumeNumber;
    this.volumeCount = failure.volumeCount;
    this.volumeTitle = failure.volumeTitle;
    this.chapterStart = failure.chapterStart;
    this.chapterEnd = failure.chapterEnd;
    this.completedVolumes = failure.completedVolumes;
    this.completedChapters = failure.completedChapters;
    this.targetChapters = failure.targetChapters;
    this.generatedChapterNumbers = failure.generatedChapterNumbers;
    this.partialMarkdown = failure.partialMarkdown;
  }

  toJSON(): VolumeMapWeaveFailure & { readonly error: string } {
    return {
      error: this.message,
      volumeNumber: this.volumeNumber,
      volumeCount: this.volumeCount,
      volumeTitle: this.volumeTitle,
      chapterStart: this.chapterStart,
      chapterEnd: this.chapterEnd,
      completedVolumes: this.completedVolumes,
      completedChapters: this.completedChapters,
      targetChapters: this.targetChapters,
      generatedChapterNumbers: this.generatedChapterNumbers,
      ...(this.partialMarkdown ? { partialMarkdown: this.partialMarkdown } : {}),
    };
  }
}

export interface VolumeMapMaterializeInput {
  readonly book: BookConfig;
  readonly storyFrame?: string;
  readonly volumeMap: string;
  readonly rolesExcerpt?: string;
  readonly language?: "zh" | "en";
  readonly mode?: VolumeMapMaterializeMode;
  readonly totalWords?: number;
  readonly onProgress?: (progress: VolumeMapWeaveProgress) => void;
}

export interface VolumeMapMaterializeResult {
  readonly markdown: string;
  readonly volumeCount: number;
  readonly chapterCount: number;
  readonly targetChapters: number;
  readonly generatedChapterNumbers: readonly number[];
  readonly step: VolumeMapWeaveStep;
  readonly moreRemaining: boolean;
  readonly nextBatchStart?: number;
  readonly nextBatchEnd?: number;
}

export class VolumeMapMaterializer extends BaseAgent {
  get name(): string {
    return "volume-map-materializer";
  }

  async materialize(input: VolumeMapMaterializeInput): Promise<VolumeMapMaterializeResult> {
    const language = input.language ?? input.book.language ?? "zh";
    const targetChapters = resolveTargetChapterCount({
      targetChapters: input.book.targetChapters,
      chapterWordCount: input.book.chapterWordCount,
      totalWords: input.totalWords,
    });
    const existing = parseVolumeMapTree(input.volumeMap);
    const existingChapters = new Map<number, VolumeMapChapterNode>();
    for (const [number, node] of chapterNodesByNumber(existing)) {
      if (node.title.trim() || node.summary.trim()) existingChapters.set(number, node);
    }
    const leftover = leftoverVolumeMapProse(input.volumeMap);
    const hinted = this.resolveHintedRanges(input.volumeMap, existing, targetChapters);
    const ranges = hinted ?? this.resolveVolumeRanges(existing, targetChapters);
    const step = this.resolveStep(input.mode, existing, input.volumeMap, targetChapters);
    const generated: number[] = [];
    const startedAt = Date.now();
    const emit = (
      phase: VolumeMapWeaveProgress["phase"],
      extra: Partial<VolumeMapWeaveProgress> & { readonly talkingToModel: boolean },
    ): void => {
      const volumeNumber = extra.volumeNumber;
      const chapterStart = extra.chapterStart;
      const chapterEnd = extra.chapterEnd;
      const volumeTitle = extra.volumeTitle;
      const message = extra.message ?? formatWeaveProgressMessage({
        language,
        phase,
        talkingToModel: extra.talkingToModel,
        volumeNumber,
        volumeCount: ranges.length,
        volumeTitle,
        chapterStart,
        chapterEnd,
        completedChapters: generated.length + existingChapters.size,
        targetChapters,
      });
      input.onProgress?.({
        phase,
        talkingToModel: extra.talkingToModel,
        volumeNumber,
        volumeCount: ranges.length,
        volumeTitle,
        chapterStart,
        chapterEnd,
        completedChapters: generated.length + existingChapters.size,
        targetChapters,
        elapsedMs: Date.now() - startedAt,
        message,
      });
    };

    if (step === "done") {
      return this.finishResult(
        this.renderExisting(ranges, existing, existingChapters, leftover, language),
        "done",
        [],
        targetChapters,
      );
    }

    if (step === "volumes") {
      emit("start", {
        talkingToModel: false,
        message: language === "en"
          ? `Locking ${ranges.length} volume ranges for review…`
          : `正在锁定卷纲（${ranges.length} 卷）`,
      });
      const markdown = renderVolumeMapMarkdown(
        this.assembleVolumes(ranges, existing, leftover, language, existingChapters, []),
        { language },
      );
      emit("volumes", {
        talkingToModel: false,
        message: language === "en"
          ? `Volume split ready · ${ranges.length} volumes`
          : `卷纲已起草：${ranges.length} 卷，请在大纲审阅`,
      });
      emit("complete", { talkingToModel: false });
      return this.finishResult(markdown, "volumes", [], targetChapters);
    }

    const batch = [...nextUnfilledChapterBatch(existing, targetChapters, MAX_CHAPTERS_PER_CALL)];
    const home = this.volumeForChapter(ranges, batch[0] ?? 1);
    emit("start", {
      talkingToModel: true,
      volumeNumber: home?.volumeNumber,
      volumeTitle: home ? this.volumeTitleFor(home, existing, language) : undefined,
      chapterStart: batch[0],
      chapterEnd: batch[batch.length - 1],
      message: formatWeaveProgressMessage({
        language,
        phase: "batch",
        talkingToModel: true,
        volumeNumber: home?.volumeNumber,
        volumeCount: ranges.length,
        volumeTitle: home ? this.volumeTitleFor(home, existing, language) : undefined,
        chapterStart: batch[0],
        chapterEnd: batch[batch.length - 1],
        completedChapters: existingChapters.size,
        targetChapters,
      }),
    });

    try {
      const created = batch.length > 0 && home
        ? await this.generateChaptersForVolume({
          book: input.book,
          language,
          storyFrame: input.storyFrame ?? "",
          rolesExcerpt: input.rolesExcerpt ?? "",
          range: home,
          title: this.volumeTitleFor(home, existing, language),
          body: this.volumeBody(
            existing.volumes.find((volume) => volume.volumeNumber === home.volumeNumber)?.body,
            leftover,
            home.volumeNumber,
            language,
          ),
          needed: batch,
          volumeCount: ranges.length,
          targetChapters,
          onChunk: (chunk) => {
            emit("batch", {
              talkingToModel: true,
              volumeNumber: home.volumeNumber,
              volumeTitle: this.volumeTitleFor(home, existing, language),
              chapterStart: chunk[0],
              chapterEnd: chunk[chunk.length - 1],
            });
          },
        })
        : [];
      generated.push(...created.map((chapter) => chapter.chapterNumber));
      const markdown = renderVolumeMapMarkdown(
        this.assembleVolumes(ranges, existing, leftover, language, existingChapters, created),
        { language },
      );
      emit("complete", {
        talkingToModel: false,
        volumeNumber: home?.volumeNumber,
        chapterStart: batch[0],
        chapterEnd: batch[batch.length - 1],
      });
      return this.finishResult(markdown, "batch", generated, targetChapters);
    } catch (error) {
      const partialMarkdown = existingChapters.size > 0
        ? this.renderExisting(ranges, existing, existingChapters, leftover, language)
        : undefined;
      if (error instanceof VolumeMapWeaveError) {
        throw new VolumeMapWeaveError(error.message, {
          volumeNumber: error.volumeNumber ?? home?.volumeNumber,
          volumeCount: ranges.length,
          volumeTitle: error.volumeTitle,
          chapterStart: error.chapterStart ?? batch[0],
          chapterEnd: error.chapterEnd ?? batch[batch.length - 1],
          completedVolumes: 0,
          completedChapters: existingChapters.size,
          targetChapters,
          generatedChapterNumbers: generated,
          partialMarkdown,
        });
      }
      throw this.wrapWeaveFailure(error, {
        language,
        volumeNumber: home?.volumeNumber ?? (error instanceof VolumeMapWeaveError ? error.volumeNumber : undefined),
        volumeTitle: home ? this.volumeTitleFor(home, existing, language) : undefined,
        chapterStart: batch[0],
        chapterEnd: batch[batch.length - 1],
        volumeCount: ranges.length,
        completedVolumes: 0,
        completedChapters: existingChapters.size,
        targetChapters,
        generatedChapterNumbers: generated,
        partialMarkdown,
      });
    }
  }

  private resolveStep(
    mode: VolumeMapMaterializeMode | undefined,
    existing: ReturnType<typeof parseVolumeMapTree>,
    volumeMap: string,
    targetChapters: number,
  ): VolumeMapWeaveStep {
    if (mode === "init" || mode === "volumes") {
      return "volumes";
    }
    const auto = resolveOutlineWeaveStep(existing, targetChapters, volumeMap);
    if (auto === "volumes") return "volumes";
    if (auto === "done") return "done";
    return "batch";
  }

  private volumeForChapter(
    ranges: ReadonlyArray<PlannedVolumeRange>,
    chapterNumber: number,
  ): PlannedVolumeRange | undefined {
    return ranges.find((range) => chapterNumber >= range.startChapter && chapterNumber <= range.endChapter)
      ?? ranges[0];
  }

  private volumeTitleFor(
    range: PlannedVolumeRange,
    existing: ReturnType<typeof parseVolumeMapTree>,
    language: "zh" | "en",
  ): string {
    const matched = existing.volumes.find((volume) => volume.volumeNumber === range.volumeNumber)
      ?? existing.volumes[range.volumeNumber - 1];
    return this.shortVolumeTitle(range.title ?? matched?.title, range.volumeNumber, language);
  }

  private assembleVolumes(
    ranges: ReadonlyArray<PlannedVolumeRange>,
    existing: ReturnType<typeof parseVolumeMapTree>,
    leftover: string,
    language: "zh" | "en",
    filled: ReadonlyMap<number, VolumeMapChapterNode>,
    created: ReadonlyArray<AssembledVolumeChapter>,
  ): AssembledVolume[] {
    const createdByNumber = new Map(created.map((chapter) => [chapter.chapterNumber, chapter]));
    return ranges.map((range) => {
      const matched = existing.volumes.find((volume) => volume.volumeNumber === range.volumeNumber)
        ?? existing.volumes[range.volumeNumber - 1];
      const chapters: AssembledVolumeChapter[] = [];
      for (const number of this.chapterNumbersInRange(range)) {
        const generated = createdByNumber.get(number);
        if (generated) {
          chapters.push(generated);
          continue;
        }
        const kept = filled.get(number);
        if (kept) {
          chapters.push({ chapterNumber: number, title: kept.title, summary: kept.summary });
        }
      }
      return {
        volumeNumber: range.volumeNumber,
        title: this.shortVolumeTitle(range.title ?? matched?.title, range.volumeNumber, language),
        startChapter: range.startChapter,
        endChapter: range.endChapter,
        body: this.volumeBody(matched?.body, leftover, range.volumeNumber, language),
        chapters,
      };
    });
  }

  private renderExisting(
    ranges: ReadonlyArray<PlannedVolumeRange>,
    existing: ReturnType<typeof parseVolumeMapTree>,
    filled: ReadonlyMap<number, VolumeMapChapterNode>,
    leftover: string,
    language: "zh" | "en",
  ): string {
    return renderVolumeMapMarkdown(
      this.assembleVolumes(ranges, existing, leftover, language, filled, []),
      { language },
    );
  }

  private finishResult(
    markdown: string,
    step: VolumeMapWeaveStep,
    generated: readonly number[],
    targetChapters: number,
  ): VolumeMapMaterializeResult {
    const tree = parseVolumeMapTree(markdown);
    const next = nextUnfilledChapterBatch(tree, targetChapters, MAX_CHAPTERS_PER_CALL);
    return {
      markdown,
      volumeCount: tree.volumeCount,
      chapterCount: listedExactChapterNumbers(tree).length,
      targetChapters,
      generatedChapterNumbers: generated,
      step,
      moreRemaining: next.length > 0,
      nextBatchStart: next[0],
      nextBatchEnd: next[next.length - 1],
    };
  }

  private resolveHintedRanges(
    volumeMap: string,
    existing: ReturnType<typeof parseVolumeMapTree>,
    targetChapters: number,
  ): ReadonlyArray<PlannedVolumeRange> | null {
    const hinted = planVolumeRangesFromHints(parseProseVolumeHints(volumeMap), targetChapters);
    if (!hinted) return null;
    const hasNamedLocked = existing.volumes.some((volume) =>
      volume.volumeNumber != null
      && volume.startChapter != null
      && volume.endChapter != null
      && !isPlaceholderVolumeTitle(volume.title),
    );
    if (hasNamedLocked) return null;
    return hinted;
  }

  private resolveVolumeRanges(
    existing: ReturnType<typeof parseVolumeMapTree>,
    targetChapters: number,
  ): ReadonlyArray<PlannedVolumeRange> {
    const ranged = existing.volumes.filter((volume) =>
      volume.volumeNumber != null
      && volume.startChapter != null
      && volume.endChapter != null
      && volume.endChapter >= volume.startChapter,
    );
    if (ranged.length > 0) {
      const last = Math.max(...ranged.map((volume) => volume.endChapter!));
      if (last >= targetChapters) {
        return ranged.map((volume) => ({
          volumeNumber: volume.volumeNumber!,
          startChapter: volume.startChapter!,
          endChapter: Math.min(volume.endChapter!, targetChapters),
          ...(isPlaceholderVolumeTitle(volume.title)
            ? {}
            : { title: volume.title.replace(/^第\s*[一二三四五六七八九十百\d]+\s*卷\s*/, "").replace(/^Volume\s+\d+\s*/i, "").trim() || undefined }),
        }));
      }
    }
    const usableCount = existing.volumes.filter((volume) => volume.volumeNumber != null).length;
    return planVolumeRanges(targetChapters, {
      existingVolumeCount: usableCount > 1 ? usableCount : undefined,
    });
  }

  private shortVolumeTitle(title: string | undefined, volumeNumber: number, language: "zh" | "en"): string {
    const cleaned = (title ?? "").replace(/^#+\s*/, "").trim();
    if (!isPlaceholderVolumeTitle(cleaned)) {
      return cleaned.replace(/^第\s*[一二三四五六七八九十百\d]+\s*卷\s*/, "").replace(/^Volume\s+\d+\s*/i, "").trim()
        || (language === "en" ? `Arc ${volumeNumber}` : `第${volumeNumber}程`);
    }
    return language === "en" ? `Arc ${volumeNumber}` : `第${volumeNumber}程`;
  }

  private volumeBody(
    existingBody: string | undefined,
    leftover: string,
    volumeNumber: number,
    language: "zh" | "en",
  ): string {
    const body = existingBody?.trim();
    if (body && !/卷一埋|卷二埋|各卷OKR/.test(body)) return body;
    if (volumeNumber === 1 && leftover) {
      const note = language === "en" ? "Notes from the previous volume map:" : "原架构笔记：";
      return `${note}\n${leftover}`;
    }
    return language === "en"
      ? `Objective: advance the book objective through chapters in this volume.\nKR1: visible foreground progress\nKR2: relationship or alliance shift\nKR3: one irreversible reveal`
      : `Objective：本卷结束时主角必须达成可验证的阶段状态。\nKR1：前台冲突推进\nKR2：关系或势力变化\nKR3：一次不可逆揭示`;
  }

  private chapterNumbersInRange(range: PlannedVolumeRange): number[] {
    const numbers: number[] = [];
    for (let chapter = range.startChapter; chapter <= range.endChapter; chapter += 1) {
      numbers.push(chapter);
    }
    return numbers;
  }

  private mergeChapters(
    range: PlannedVolumeRange,
    preserved: ReadonlyArray<AssembledVolumeChapter>,
    created: ReadonlyArray<AssembledVolumeChapter>,
  ): ReadonlyArray<AssembledVolumeChapter> {
    const byNumber = new Map<number, AssembledVolumeChapter>();
    for (const chapter of created) byNumber.set(chapter.chapterNumber, chapter);
    for (const chapter of preserved) byNumber.set(chapter.chapterNumber, chapter);
    return this.chapterNumbersInRange(range).map((number) =>
      byNumber.get(number) ?? {
        chapterNumber: number,
        title: `节点${number}`,
        summary: "待作者补提要。",
      },
    );
  }

  private async generateChaptersForVolume(params: {
    readonly book: BookConfig;
    readonly language: "zh" | "en";
    readonly storyFrame: string;
    readonly rolesExcerpt: string;
    readonly range: PlannedVolumeRange;
    readonly title: string;
    readonly body: string;
    readonly needed: ReadonlyArray<number>;
    readonly volumeCount: number;
    readonly targetChapters: number;
    readonly onChunk?: (chunk: ReadonlyArray<number>) => void;
  }): Promise<ReadonlyArray<AssembledVolumeChapter>> {
    // Hard cap: even if a caller still passes "all missing", only one batch of 10 runs.
    const needed = params.needed.slice(0, MAX_CHAPTERS_PER_CALL);
    const chunks: number[][] = [];
    for (let index = 0; index < needed.length; index += MAX_CHAPTERS_PER_CALL) {
      chunks.push(needed.slice(index, index + MAX_CHAPTERS_PER_CALL));
    }
    const collected: AssembledVolumeChapter[] = [];
    for (const chunk of chunks) {
      params.onChunk?.(chunk);
      try {
        collected.push(...await this.generateChapterChunk(params, chunk));
      } catch (error) {
        throw this.wrapWeaveFailure(error, {
          language: params.language,
          volumeNumber: params.range.volumeNumber,
          volumeTitle: params.title,
          chapterStart: chunk[0],
          chapterEnd: chunk[chunk.length - 1],
          volumeCount: params.volumeCount,
          completedVolumes: 0,
          completedChapters: collected.length,
          targetChapters: params.targetChapters,
          generatedChapterNumbers: collected.map((chapter) => chapter.chapterNumber),
        });
      }
    }
    const have = new Set(collected.map((chapter) => chapter.chapterNumber));
    const missing = needed.filter((number) => !have.has(number));
    if (missing.length > 0) {
      params.onChunk?.(missing);
      try {
        collected.push(...await this.generateChapterChunk(params, missing));
      } catch (error) {
        throw this.wrapWeaveFailure(error, {
          language: params.language,
          volumeNumber: params.range.volumeNumber,
          volumeTitle: params.title,
          chapterStart: missing[0],
          chapterEnd: missing[missing.length - 1],
          volumeCount: params.volumeCount,
          completedVolumes: 0,
          completedChapters: collected.length,
          targetChapters: params.targetChapters,
          generatedChapterNumbers: collected.map((chapter) => chapter.chapterNumber),
        });
      }
    }
    return collected;
  }

  private async generateChapterChunk(
    params: {
      readonly book: BookConfig;
      readonly language: "zh" | "en";
      readonly storyFrame: string;
      readonly rolesExcerpt: string;
      readonly range: PlannedVolumeRange;
      readonly title: string;
      readonly body: string;
    },
    needed: ReadonlyArray<number>,
  ): Promise<ReadonlyArray<AssembledVolumeChapter>> {
    if (needed.length === 0) return [];
    const system = params.language === "en"
      ? [
        "You materialize a novel outline chapter list.",
        "Output ONLY markdown chapter headings and 1-3 sentence summaries.",
        "Each chapter must be exactly:",
        "## Chapter N Short Title",
        "One to three sentences.",
        "Do not emit volume headings, tables, or commentary.",
        `Write every chapter in this set: ${needed.join(", ")}.`,
      ].join("\n")
      : [
        "你负责把一卷的章级大纲落到可解析的 Markdown。",
        "只输出章标题和 1-3 句提要，不要写卷标题、表格或解释。",
        "每一章必须是：",
        "## 第 N 章 短标题",
        "一两句到三句内容提要。",
        `必须写全这些章号：${needed.join("、")}。`,
      ].join("\n");
    const user = params.language === "en"
      ? `Book: ${params.book.title}\nTarget chapters: ${params.book.targetChapters}\nChapter length: ${params.book.chapterWordCount}\nVolume ${params.range.volumeNumber} ${params.title} (${params.range.startChapter}-${params.range.endChapter})\nVolume body:\n${params.body}\n\nStory frame:\n${params.storyFrame.slice(0, 1800)}\n\nRoles:\n${params.rolesExcerpt.slice(0, 800)}`
      : `书名：${params.book.title}\n目标章数：${params.book.targetChapters}\n每章字数：${params.book.chapterWordCount}\n第${params.range.volumeNumber}卷 ${params.title}（${params.range.startChapter}-${params.range.endChapter}章）\n卷正文：\n${params.body}\n\n故事框架：\n${params.storyFrame.slice(0, 1800)}\n\n角色：\n${params.rolesExcerpt.slice(0, 800)}`;

    const response = await this.chat([
      { role: "system", content: system },
      { role: "user", content: user },
    ], {
      temperature: 0.6,
      firstEventTimeoutMs: MATERIALIZER_FIRST_EVENT_TIMEOUT_MS,
      streamIdleTimeoutMs: MATERIALIZER_STREAM_IDLE_TIMEOUT_MS,
      overallTimeoutMs: MATERIALIZER_OVERALL_TIMEOUT_MS,
      ...(isKimiK3Model(this.ctx.model) ? { extra: { reasoning_effort: "low" } } : {}),
    });

    const parsed = parseVolumeMapTree(response.content);
    const byNumber = chapterNodesByNumber(parsed);
    return needed
      .map((number) => {
        const node = byNumber.get(number);
        if (!node) return null;
        return {
          chapterNumber: number,
          title: node.title || (params.language === "en" ? `Beat ${number}` : `节点${number}`),
          summary: node.summary || node.title,
        };
      })
      .filter((chapter): chapter is AssembledVolumeChapter => chapter != null);
  }

  private wrapWeaveFailure(
    error: unknown,
    extras: {
      readonly language: "zh" | "en";
      readonly volumeNumber?: number;
      readonly volumeTitle?: string;
      readonly chapterStart?: number;
      readonly chapterEnd?: number;
      readonly volumeCount: number;
      readonly completedVolumes: number;
      readonly completedChapters: number;
      readonly targetChapters: number;
      readonly generatedChapterNumbers: readonly number[];
      readonly partialMarkdown?: string;
    },
  ): VolumeMapWeaveError {
    const cause = error instanceof Error ? error.message : String(error);
    this.log?.error(`[weave] abort: ${cause}`, {
      volumeNumber: extras.volumeNumber,
      chapterStart: extras.chapterStart,
      chapterEnd: extras.chapterEnd,
    });
    return new VolumeMapWeaveError(
      formatWeaveFailureMessage(extras.language, extras, cause, isWeaveTimeoutCause(error, cause)),
      extras,
    );
  }
}

export function formatWeaveProgressMessage(progress: {
  readonly language: "zh" | "en";
  readonly phase: VolumeMapWeaveProgress["phase"];
  readonly talkingToModel: boolean;
  readonly volumeNumber?: number;
  readonly volumeCount: number;
  readonly volumeTitle?: string;
  readonly chapterStart?: number;
  readonly chapterEnd?: number;
  readonly completedChapters: number;
  readonly targetChapters: number;
}): string {
  const volumeBit = progress.volumeNumber != null
    ? (progress.language === "en"
      ? `Volume ${progress.volumeNumber}${progress.volumeTitle ? ` ${progress.volumeTitle}` : ""}`
      : `第${progress.volumeNumber}卷${progress.volumeTitle ? ` ${progress.volumeTitle}` : ""}`)
    : (progress.language === "en"
      ? `${progress.volumeCount} volumes`
      : `${progress.volumeCount} 卷`);
  const chapterBit = progress.chapterStart != null && progress.chapterEnd != null
    ? (progress.language === "en"
      ? ` ch. ${progress.chapterStart}–${progress.chapterEnd}`
      : ` 第${progress.chapterStart}–${progress.chapterEnd}章`)
    : "";
  const talking = progress.talkingToModel
    ? (progress.language === "en" ? " · talking to the model" : " · 正在请求模型")
    : "";
  return `${volumeBit}${chapterBit}${talking} · ${progress.completedChapters}/${progress.targetChapters}`;
}

export function isWeaveTimeoutCause(error: unknown, cause = ""): boolean {
  if (error instanceof LLMStreamInactivityError) return true;
  return /exceeded overall timeout|produced no (?:event|token)|调用超时|模型还在想|织卷超时/i.test(cause);
}

export function formatWeaveFailureMessage(
  language: "zh" | "en",
  failure: Pick<VolumeMapWeaveFailure, "volumeNumber" | "volumeCount" | "volumeTitle" | "chapterStart" | "chapterEnd" | "completedChapters" | "targetChapters">,
  cause: string,
  timedOut = isWeaveTimeoutCause(undefined, cause),
): string {
  const where = failure.volumeNumber != null
    ? (language === "en"
      ? `volume ${failure.volumeNumber}/${failure.volumeCount || "?"}${failure.volumeTitle ? ` (${failure.volumeTitle})` : ""}`
      : `第${failure.volumeNumber}/${failure.volumeCount || "?"}卷${failure.volumeTitle ? `《${failure.volumeTitle}》` : ""}`)
    : (language === "en" ? "outline weave" : "织卷");
  const chunk = failure.chapterStart != null && failure.chapterEnd != null
    ? (language === "en"
      ? ` chapters ${failure.chapterStart}–${failure.chapterEnd}`
      : ` 第${failure.chapterStart}–${failure.chapterEnd}章`)
    : "";
  if (timedOut) {
    return language === "en"
      ? `Weave timed out — the model was still thinking. ${where}${chunk}: ${cause} Completed ${failure.completedChapters}/${failure.targetChapters} chapters. Retry remaining after review.`
      : `织卷超时，模型还在想：${where}${chunk} — ${cause} 已完成 ${failure.completedChapters}/${failure.targetChapters} 章。可再点织卷补 remaining。`;
  }
  return language === "en"
    ? `Weave failed on ${where}${chunk}: ${cause} Completed ${failure.completedChapters}/${failure.targetChapters} chapters. Retry remaining after review.`
    : `织卷失败：${where}${chunk} — ${cause} 已完成 ${failure.completedChapters}/${failure.targetChapters} 章。可再点织卷补 remaining。`;
}

export function rolesExcerptFromArchitect(roles: ReadonlyArray<{ readonly name: string; readonly content: string }> | undefined): string {
  if (!roles?.length) return "";
  return roles.slice(0, 4).map((role) => `## ${role.name}\n${role.content.slice(0, 240)}`).join("\n\n");
}

export function volumeMapNeedsMaterialize(volumeMap: string, targetChapters: number): boolean {
  return missingExactChapters(parseVolumeMapTree(volumeMap), targetChapters).length > 0;
}
