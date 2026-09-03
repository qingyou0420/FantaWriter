/**
 * Post-architect materializer: turn a volume skeleton (or leftover prose)
 * into a parseable 卷→章 tree covering every planned chapter.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { BaseAgent } from "./base.js";
import type { BookConfig } from "../models/book.js";
import {
  chapterNodesByNumber,
  leftoverVolumeMapProse,
  listedExactChapterNumbers,
  missingExactChapters,
  parseProseVolumeHints,
  parseVolumeMapTree,
  planVolumeRanges,
  planVolumeRangesFromHints,
  renderVolumeMapMarkdown,
  resolveTargetChapterCount,
  volumeMapHasReviewableTree,
  type AssembledVolume,
  type AssembledVolumeChapter,
  type PlannedVolumeRange,
  type VolumeMapChapterNode,
} from "../utils/volume-map-tree.js";

export type VolumeMapMaterializeMode = "init" | "remaining" | "full";

export interface VolumeMapMaterializeInput {
  readonly book: BookConfig;
  readonly storyFrame?: string;
  readonly volumeMap: string;
  readonly rolesExcerpt?: string;
  readonly language?: "zh" | "en";
  readonly mode?: VolumeMapMaterializeMode;
  readonly totalWords?: number;
}

export interface VolumeMapMaterializeResult {
  readonly markdown: string;
  readonly volumeCount: number;
  readonly chapterCount: number;
  readonly targetChapters: number;
  readonly generatedChapterNumbers: readonly number[];
}

const MAX_CHAPTERS_PER_CALL = 40;

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
    const keepExisting = input.mode !== "full";
    const existingChapters = new Map<number, VolumeMapChapterNode>();
    if (keepExisting) {
      for (const [number, node] of chapterNodesByNumber(existing)) {
        if (node.title.trim() || node.summary.trim()) existingChapters.set(number, node);
      }
    }
    const leftover = leftoverVolumeMapProse(input.volumeMap);
    const hinted = this.resolveHintedRanges(input.volumeMap, existing, targetChapters);
    const ranges = hinted ?? this.resolveVolumeRanges(existing, targetChapters);
    const generated: number[] = [];

    const volumes: AssembledVolume[] = [];
    for (const range of ranges) {
      const matchedVolume = existing.volumes.find((volume) => volume.volumeNumber === range.volumeNumber)
        ?? existing.volumes[range.volumeNumber - 1];
      const title = this.shortVolumeTitle(range.title ?? matchedVolume?.title, range.volumeNumber, language);
      const body = this.volumeBody(matchedVolume?.body, leftover, range.volumeNumber, language);
      const needed = this.chapterNumbersInRange(range).filter((number) => !existingChapters.has(number));
      const preserved = this.chapterNumbersInRange(range)
        .filter((number) => existingChapters.has(number))
        .map((number) => {
          const node = existingChapters.get(number)!;
          return {
            chapterNumber: number,
            title: node.title,
            summary: node.summary,
          };
        });
      const created = needed.length > 0
        ? await this.generateChaptersForVolume({
          book: input.book,
          language,
          storyFrame: input.storyFrame ?? "",
          rolesExcerpt: input.rolesExcerpt ?? "",
          range,
          title,
          body,
          needed,
        })
        : [];
      generated.push(...created.map((chapter) => chapter.chapterNumber));
      const merged = this.mergeChapters(range, preserved, created);
      volumes.push({
        volumeNumber: range.volumeNumber,
        title,
        startChapter: range.startChapter,
        endChapter: range.endChapter,
        body,
        chapters: merged,
      });
    }

    const markdown = renderVolumeMapMarkdown(volumes, { language });
    const tree = parseVolumeMapTree(markdown);
    if (!volumeMapHasReviewableTree(tree, targetChapters)) {
      throw new Error(
        language === "en"
          ? `Outline materializer did not produce ${targetChapters} chapter entries (got ${listedExactChapterNumbers(tree).length}).`
          : `织卷未能写出全部 ${targetChapters} 章条目（实际 ${listedExactChapterNumbers(tree).length}）。`,
      );
    }
    return {
      markdown,
      volumeCount: tree.volumeCount,
      chapterCount: listedExactChapterNumbers(tree).length,
      targetChapters,
      generatedChapterNumbers: generated,
    };
  }

  private resolveHintedRanges(
    volumeMap: string,
    existing: ReturnType<typeof parseVolumeMapTree>,
    targetChapters: number,
  ): ReadonlyArray<PlannedVolumeRange> | null {
    const hasRealVolumes = existing.volumes.some((volume) =>
      volume.volumeNumber != null
      && volume.startChapter != null
      && volume.endChapter != null,
    );
    if (hasRealVolumes) return null;
    return planVolumeRangesFromHints(parseProseVolumeHints(volumeMap), targetChapters);
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
    if (cleaned && cleaned.length <= 16 && !/埋线?|各卷OKR|KR\s*\d+/.test(cleaned)) {
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
  }): Promise<ReadonlyArray<AssembledVolumeChapter>> {
    const chunks: number[][] = [];
    for (let index = 0; index < params.needed.length; index += MAX_CHAPTERS_PER_CALL) {
      chunks.push(params.needed.slice(index, index + MAX_CHAPTERS_PER_CALL));
    }
    const collected: AssembledVolumeChapter[] = [];
    for (const chunk of chunks) {
      collected.push(...await this.generateChapterChunk(params, chunk));
    }
    const have = new Set(collected.map((chapter) => chapter.chapterNumber));
    const missing = params.needed.filter((number) => !have.has(number));
    if (missing.length > 0) {
      collected.push(...await this.generateChapterChunk(params, missing));
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
    ], { temperature: 0.6 });

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
}

export function rolesExcerptFromArchitect(roles: ReadonlyArray<{ readonly name: string; readonly content: string }> | undefined): string {
  if (!roles?.length) return "";
  return roles.slice(0, 4).map((role) => `## ${role.name}\n${role.content.slice(0, 240)}`).join("\n\n");
}

export function volumeMapNeedsMaterialize(volumeMap: string, targetChapters: number): boolean {
  return missingExactChapters(parseVolumeMapTree(volumeMap), targetChapters).length > 0;
}
