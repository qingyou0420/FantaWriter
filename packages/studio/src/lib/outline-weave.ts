/**
 * 织卷: lock volumes first, then weave one 10-chapter batch per click
 * through the confirm gate. Never dump the whole book in one POST.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
  MAX_VOLUME_TREE_LABEL_CHARS,
  formatVolumeLabel,
  nextUnfilledChapterBatch,
  resolveOutlineWeaveStep,
  truncateOutlineLabel,
  type OutlineWeaveStep,
  type VolumeMapTree,
} from "./volume-map-tree";

export type OutlineWeaveMode = "volumes" | "batch";

export type OutlineWeavePhase = "start" | "chunk" | "volume" | "complete" | "error";

export interface OutlineWeaveProgress {
  readonly bookId?: string;
  readonly phase: OutlineWeavePhase;
  readonly talkingToModel: boolean;
  readonly volumeNumber?: number;
  readonly volumeCount?: number;
  readonly volumeTitle?: string;
  readonly chapterStart?: number;
  readonly chapterEnd?: number;
  readonly completedChapters?: number;
  readonly targetChapters?: number;
  readonly elapsedMs: number;
  readonly message: string;
}

export interface OutlineWeaveAction {
  readonly step: OutlineWeaveStep;
  readonly mode: OutlineWeaveMode;
  readonly chapterStart?: number;
  readonly chapterEnd?: number;
  readonly disabled: boolean;
}

export function resolveOutlineWeaveAction(
  tree: VolumeMapTree,
  targetChapters: number,
  volumeMap = "",
): OutlineWeaveAction {
  const step = resolveOutlineWeaveStep(tree, targetChapters, volumeMap);
  if (step === "volumes") {
    return { step, mode: "volumes", disabled: false };
  }
  const batch = nextUnfilledChapterBatch(tree, targetChapters, 10);
  if (step === "done" || batch.length === 0) {
    return { step: "done", mode: "batch", disabled: true };
  }
  return {
    step: "batch",
    mode: "batch",
    chapterStart: batch[0],
    chapterEnd: batch[batch.length - 1],
    disabled: false,
  };
}

export function outlineWeaveButtonLabel(action: OutlineWeaveAction, isZh: boolean): string {
  if (action.step === "volumes") return isZh ? "织卷 · 锁定卷纲" : "织卷 · Lock volumes";
  if (action.step === "done") return isZh ? "卷纲已齐" : "Outline complete";
  if (action.chapterStart != null && action.chapterEnd != null) {
    return isZh
      ? `织卷 · 下一批（第${action.chapterStart}–${action.chapterEnd}章）`
      : `织卷 · Next 10 (ch. ${action.chapterStart}–${action.chapterEnd})`;
  }
  return isZh ? "织卷 · 下一批" : "织卷 · Next 10";
}

export function outlineWeavePrompt(isZh: boolean, mode: OutlineWeaveMode): string {
  if (isZh) {
    return mode === "volumes"
      ? "先锁定卷纲（短标题 + 章范围 + OKR），走确认闸，不写章提要。"
      : "只织下一批 10 章标题和提要（走确认闸），不要一次排完全书。";
  }
  return mode === "volumes"
    ? "Lock the volume split (short titles + ranges + OKR) through the confirm gate. No chapter summaries yet."
    : "Weave the next 10 chapter headings and summaries (confirm gate). Do not dump the whole book.";
}

export function formatOutlineWeaveElapsed(elapsedMs: number, isZh: boolean): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return isZh ? `${seconds}s` : `${seconds}s`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatOutlineWeaveProgress(progress: OutlineWeaveProgress, isZh: boolean): string {
  if (progress.message.trim()) {
    return `${progress.message} · ${formatOutlineWeaveElapsed(progress.elapsedMs, isZh)}`;
  }
  const volumeBit = progress.volumeNumber != null && progress.volumeCount != null
    ? (isZh
      ? `第${progress.volumeNumber}/${progress.volumeCount}卷`
      : `Volume ${progress.volumeNumber}/${progress.volumeCount}`)
    : (isZh ? "织卷中" : "Weaving");
  const chapterBit = progress.chapterStart != null && progress.chapterEnd != null
    ? (isZh ? ` 章 ${progress.chapterStart}–${progress.chapterEnd}` : ` ch. ${progress.chapterStart}–${progress.chapterEnd}`)
    : "";
  const talking = progress.talkingToModel
    ? (isZh ? " · 正在请求模型" : " · talking to the model")
    : "";
  return `${volumeBit}${chapterBit}${talking} · ${formatOutlineWeaveElapsed(progress.elapsedMs, isZh)}`;
}

export function isOutlineWeaveEvent(event: string): boolean {
  return event === "weave:start" || event === "weave:progress" || event === "weave:complete" || event === "weave:error";
}

export function applyOutlineWeaveSseEvent(
  bookId: string,
  event: string,
  data: unknown,
  startedAt: number,
): OutlineWeaveProgress | null {
  if (!isOutlineWeaveEvent(event) || !data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  if (typeof payload.bookId === "string" && payload.bookId !== bookId) return null;
  const phase: OutlineWeavePhase = event === "weave:start"
    ? "start"
    : event === "weave:complete"
      ? "complete"
      : event === "weave:error"
        ? "error"
        : "chunk";
  const talkingToModel = payload.talkingToModel === true || phase === "chunk" || phase === "start";
  const message = typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : "";
  return {
    bookId,
    phase,
    talkingToModel: phase === "complete" || phase === "error" ? false : talkingToModel,
    volumeNumber: typeof payload.volumeNumber === "number" ? payload.volumeNumber : undefined,
    volumeCount: typeof payload.volumeCount === "number" ? payload.volumeCount : undefined,
    volumeTitle: typeof payload.volumeTitle === "string" ? payload.volumeTitle : undefined,
    chapterStart: typeof payload.chapterStart === "number" ? payload.chapterStart : undefined,
    chapterEnd: typeof payload.chapterEnd === "number" ? payload.chapterEnd : undefined,
    completedChapters: typeof payload.completedChapters === "number" ? payload.completedChapters : undefined,
    targetChapters: typeof payload.targetChapters === "number" ? payload.targetChapters : undefined,
    elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : Date.now() - startedAt,
    message,
  };
}

export function readOutlineWeaveErrorBody(body: unknown): {
  readonly message: string;
  readonly proposal?: { readonly id: string; readonly fileName: string; readonly unifiedDiff?: string; readonly status?: string };
} {
  if (!body || typeof body !== "object") {
    return { message: "织卷 failed" };
  }
  const payload = body as Record<string, unknown>;
  const message = typeof payload.error === "string" && payload.error.trim()
    ? payload.error
    : "织卷 failed";
  const proposal = payload.proposal && typeof payload.proposal === "object"
    ? payload.proposal as { id?: unknown; fileName?: unknown; unifiedDiff?: unknown; status?: unknown }
    : undefined;
  return {
    message,
    proposal: typeof proposal?.id === "string" && typeof proposal.fileName === "string"
      ? {
        id: proposal.id,
        fileName: proposal.fileName,
        unifiedDiff: typeof proposal.unifiedDiff === "string" ? proposal.unifiedDiff : undefined,
        status: typeof proposal.status === "string" ? proposal.status : undefined,
      }
      : undefined,
  };
}

export function outlineTreeVolumeLabel(
  volumeNumber: number | null,
  title: string,
  isZh: boolean,
): string {
  return truncateOutlineLabel(formatVolumeLabel(volumeNumber, title, isZh), MAX_VOLUME_TREE_LABEL_CHARS);
}

export function outlineTreeHeadingTooLong(label: string): boolean {
  return label.length > MAX_VOLUME_TREE_LABEL_CHARS;
}
