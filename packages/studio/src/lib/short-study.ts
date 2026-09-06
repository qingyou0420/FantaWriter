/**
 * Short-fiction 创作书房: 问心 · 织卷 · 落笔.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { BookStepState } from "./book-stage.js";
import type { StudioShortContentKind, StudioShortStatus } from "../shared/short-works.js";

export type ShortStudyStep = "ask" | "weave" | "write";
export type ShortStudyCta = "ask" | "outline" | "write" | "export";

export interface ShortStudySnapshot {
  readonly stage: ShortStudyStep;
  readonly steps: Record<ShortStudyStep, BookStepState>;
  readonly primaryCta: ShortStudyCta;
}

const ORDER: ReadonlyArray<ShortStudyStep> = ["ask", "weave", "write"];

export function deriveShortStudy(input: {
  readonly status: StudioShortStatus;
  readonly contentKind?: StudioShortContentKind;
  readonly hasDirection?: boolean;
}): ShortStudySnapshot {
  const hasOutline = input.contentKind === "outline";
  const hasDraft = input.contentKind === "draft" || input.contentKind === "manuscript" || input.status === "drafting";
  const completed = input.status === "completed";

  let stage: ShortStudyStep = "ask";
  if (completed || hasDraft) stage = "write";
  else if (hasOutline || input.hasDirection) stage = "weave";

  const askDone = stage !== "ask" || Boolean(input.hasDirection) || hasOutline || hasDraft || completed;
  const weaveDone = hasDraft || completed;
  const writeDone = completed;
  const currentIndex = ORDER.indexOf(stage);

  const steps: Record<ShortStudyStep, BookStepState> = {
    ask: currentIndex === 0 ? "current" : askDone || currentIndex > 0 ? "done" : "todo",
    weave: currentIndex === 1 ? "current" : weaveDone || currentIndex > 1 ? "done" : "todo",
    write: currentIndex === 2 ? (writeDone ? "done" : "current") : writeDone ? "done" : "todo",
  };

  let primaryCta: ShortStudyCta = "ask";
  if (completed) primaryCta = "export";
  else if (stage === "write") primaryCta = "write";
  else if (stage === "weave") primaryCta = "outline";

  return { stage, steps, primaryCta };
}

export function shortStudyCtaLabel(cta: ShortStudyCta, isZh: boolean): string {
  if (cta === "ask") return isZh ? "继续问心" : "Continue asking";
  if (cta === "outline") return isZh ? "审阅大纲" : "Review outline";
  if (cta === "write") return isZh ? "继续落笔" : "Continue writing";
  return isZh ? "导出" : "Export";
}
