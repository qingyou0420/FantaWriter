/**
 * Hook overdue ledger (blueprint §3.4). Optional targetChapter on a hook
 * turns "forgotten payoff" into an account: due when current >= target,
 * overdue when current > target and still open.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { AuditIssue } from "../agents/continuity.js";
import type { HookRecord } from "../models/runtime-state.js";
import type { StoredHook } from "../state/memory-db.js";

export type HookWithTarget = StoredHook | HookRecord | {
  readonly hookId: string;
  readonly startChapter: number;
  readonly type?: string;
  readonly status: string;
  readonly lastAdvancedChapter?: number;
  readonly expectedPayoff?: string;
  readonly notes?: string;
  readonly targetChapter?: number;
  readonly coreHook?: boolean;
  readonly promoted?: boolean;
};

export type HookDueState = "open" | "due" | "overdue" | "resolved";

const RESOLVED = /^(resolved|closed|done|已回收|已逾期回收|已解决|deferred|paused|hold|延后|延期|搁置|暂缓)$/i;

export function parseTargetChapterHint(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /(?:target(?:Chapter)?|due(?:Chapter)?|到期)\s*[:：#]?\s*(\d+)/i.exec(value);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

export function resolveHookTargetChapter(hook: HookWithTarget): number | undefined {
  const explicit = "targetChapter" in hook ? hook.targetChapter : undefined;
  if (typeof explicit === "number" && Number.isInteger(explicit) && explicit >= 1) {
    return explicit;
  }
  return parseTargetChapterHint(hook.notes);
}

export function isHookResolved(status: string): boolean {
  return RESOLVED.test(status.trim());
}

export function classifyHookDue(hook: HookWithTarget, currentChapter: number): HookDueState {
  if (isHookResolved(hook.status)) return "resolved";
  const target = resolveHookTargetChapter(hook);
  if (!target) return "open";
  if (currentChapter > target) return "overdue";
  if (currentChapter === target) return "due";
  return "open";
}

export function selectDueHooks(
  hooks: ReadonlyArray<HookWithTarget>,
  currentChapter: number,
): ReadonlyArray<HookWithTarget> {
  return hooks.filter((hook) => {
    const state = classifyHookDue(hook, currentChapter);
    return state === "due" || state === "overdue";
  });
}

export function selectOverdueHooks(
  hooks: ReadonlyArray<HookWithTarget>,
  currentChapter: number,
): ReadonlyArray<HookWithTarget> {
  return hooks.filter((hook) => classifyHookDue(hook, currentChapter) === "overdue");
}

export function overdueHookAuditIssues(
  hooks: ReadonlyArray<HookWithTarget>,
  currentChapter: number,
): AuditIssue[] {
  return selectOverdueHooks(hooks, currentChapter).map((hook) => {
    const target = resolveHookTargetChapter(hook) ?? currentChapter;
    return {
      severity: "critical" as const,
      category: "hook-debt",
      description: `Hook ${hook.hookId} is overdue (target chapter ${target}, now chapter ${currentChapter}).`,
      suggestion: `Advance, resolve, or explicitly defer ${hook.hookId} in this chapter.`,
    };
  });
}
