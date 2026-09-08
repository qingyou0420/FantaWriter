import type { AuditIssue } from "../agents/continuity.js";
import type { HookRecord, RuntimeStateDelta } from "../models/runtime-state.js";
import { classifyHookDisposition, collectStaleHookDebt } from "./hook-governance.js";
import { describeHookLifecycle, localizeHookPayoffTiming, normalizeStoredHookStatus } from "./hook-lifecycle.js";
import { HOOK_HEALTH_DEFAULTS } from "./hook-policy.js";

export function analyzeHookHealth(params: {
  readonly language: "zh" | "en";
  readonly chapterNumber: number;
  readonly targetChapters?: number;
  readonly hooks: ReadonlyArray<HookRecord>;
  readonly delta?: Pick<RuntimeStateDelta, "chapter" | "hookOps">;
  readonly existingHookIds?: ReadonlyArray<string>;
  readonly maxActiveHooks?: number;
  readonly staleAfterChapters?: number;
  readonly noAdvanceWindow?: number;
  readonly newHookBurstThreshold?: number;
}): AuditIssue[] {
  const maxActiveHooks = params.maxActiveHooks ?? HOOK_HEALTH_DEFAULTS.maxActiveHooks;
  const staleAfterChapters = params.staleAfterChapters ?? HOOK_HEALTH_DEFAULTS.staleAfterChapters;
  const noAdvanceWindow = params.noAdvanceWindow ?? HOOK_HEALTH_DEFAULTS.noAdvanceWindow;
  const newHookBurstThreshold = params.newHookBurstThreshold ?? HOOK_HEALTH_DEFAULTS.newHookBurstThreshold;
  const issues: AuditIssue[] = [];

  const activeHooks = params.hooks.filter((hook) => {
    const status = normalizeStoredHookStatus(hook.status);
    return status !== "resolved" && status !== "deferred";
  });
  const lifecycleEntries = activeHooks.map((hook) => ({
    hook,
    lifecycle: describeHookLifecycle({
      payoffTiming: hook.payoffTiming,
      expectedPayoff: hook.expectedPayoff,
      notes: hook.notes,
      startChapter: hook.startChapter,
      lastAdvancedChapter: hook.lastAdvancedChapter,
      status: hook.status,
      chapterNumber: params.chapterNumber,
      targetChapters: params.targetChapters,
    }),
  }));

  if (activeHooks.length > maxActiveHooks) {
    issues.push(warning(
      params.language,
      params.language === "en"
        ? `There are ${activeHooks.length} unresolved threads still in play, more than the ${maxActiveHooks} this book can comfortably carry.`
        : `当前还压着 ${activeHooks.length} 条没回收的伏笔，比这本书舒服能扛的 ${maxActiveHooks} 条要多。`,
      params.language === "en"
        ? "Move, close, or set aside an existing thread before planting more."
        : "先推进、收束或按下已有伏笔，再继续埋新的。",
    ));
  }

  const staleHookIds = new Set(collectStaleHookDebt({
    hooks: activeHooks,
    chapterNumber: params.chapterNumber,
    targetChapters: params.targetChapters,
    staleAfterChapters,
  }).map((hook) => hook.hookId));
  const pressuredHooks = lifecycleEntries.filter(({ hook, lifecycle }) =>
    staleHookIds.has(hook.hookId)
    || lifecycle.readyToResolve
    || lifecycle.overdue,
  );
  const unresolvedPressure = pressuredHooks.filter(({ hook }) => {
    if (!params.delta) {
      return true;
    }

    const disposition = classifyHookDisposition({
      hookId: hook.hookId,
      delta: params.delta,
    });
    return disposition === "none" || disposition === "mention";
  });
  if (unresolvedPressure.length > 0) {
    issues.push(warning(
      params.language,
      buildPressureDescription({
        language: params.language,
        entries: unresolvedPressure,
        mentionsCurrentChapter: Boolean(params.delta),
      }),
      params.language === "en"
        ? "Let one overdue thread actually move, close, or be set aside before planting more of the same kind."
        : "先让一条已经该收的伏笔真正推进、收束或明确按下，再继续埋同类的新线。",
    ));
  } else {
    const latestRealAdvance = activeHooks.reduce(
      (max, hook) => Math.max(max, hook.lastAdvancedChapter),
      0,
    );
    if (
      params.noAdvanceWindow !== undefined
      && activeHooks.length > 0
      && params.chapterNumber - latestRealAdvance >= noAdvanceWindow
    ) {
      issues.push(warning(
        params.language,
        params.language === "en"
          ? `No planted thread has truly moved for ${params.chapterNumber - latestRealAdvance} chapters.`
          : `已经连续 ${params.chapterNumber - latestRealAdvance} 章，没有哪条伏笔真正往前走。`,
        params.language === "en"
          ? "Give one older thread a real beat instead of restating several in parallel."
          : "下一章先让一条旧伏笔真正动一动，不要几条一起空提。",
      ));
    }
  }

  if (params.delta) {
    const existingHookIds = new Set(params.existingHookIds ?? []);
    const resultingHookIds = new Set(params.hooks.map((hook) => hook.hookId));
    const newHookIds = params.delta.hookOps.upsert
      .map((hook) => hook.hookId)
      .filter((hookId) => !existingHookIds.has(hookId) && resultingHookIds.has(hookId));

    if (newHookIds.length >= newHookBurstThreshold && params.delta.hookOps.resolve.length === 0) {
      issues.push(warning(
        params.language,
        params.language === "en"
          ? `Opened ${newHookIds.length} new threads without closing any older ones.`
          : `本章新埋了 ${newHookIds.length} 条伏笔，却没有收束任何旧的。`,
        params.language === "en"
          ? "Pair a new plant with an older payoff so the page does not keep stacking unfinished threads."
          : "新埋一条时，尽量顺手收一条旧的，别只往上叠。",
      ));
    }
  }

  return issues;
}

function buildPressureDescription(params: {
  readonly language: "zh" | "en";
  readonly entries: ReadonlyArray<{
    readonly hook: HookRecord;
    readonly lifecycle: ReturnType<typeof describeHookLifecycle>;
  }>;
  readonly mentionsCurrentChapter: boolean;
}): string {
  const summarized = params.entries
    .slice(0, 3)
    .map(({ hook, lifecycle }) => {
      const timing = localizeHookPayoffTiming(lifecycle.timing, params.language);
      const pressure = localizePressureLabel(lifecycle, params.language);
      const name = hookAuthorName(hook);
      const label = name
        ? (params.language === "en" ? `“${name}” (${hook.hookId})` : `「${name}」（${hook.hookId}）`)
        : (params.language === "en" ? `a planted thread (${hook.hookId})` : `某条伏笔（${hook.hookId}）`);
      return params.language === "en"
        ? `${label} (${timing}, ${pressure})`
        : `${label}（${timing}，${pressure}）`;
    });
  const suffix = params.entries.length > summarized.length
    ? params.language === "en"
      ? `, +${params.entries.length - summarized.length} more`
      : `，另有 ${params.entries.length - summarized.length} 条`
    : "";

  if (params.language === "en") {
    return params.mentionsCurrentChapter
      ? `These threads are already under payoff pressure but this chapter left them untouched: ${summarized.join(", ")}${suffix}.`
      : `These threads are already under payoff pressure without recent movement: ${summarized.join(", ")}${suffix}.`;
  }

  return params.mentionsCurrentChapter
    ? `这些伏笔已经该推进或收束，但本章没有真正写到：${summarized.join("、")}${suffix}。`
    : `这些伏笔已经该推进或收束，但近期没有真正往前走：${summarized.join("、")}${suffix}。`;
}

function hookAuthorName(hook: HookRecord): string {
  const payoff = hook.expectedPayoff?.trim() ?? "";
  if (payoff && payoff.length <= 24 && !/^[A-Za-z]?\d{1,4}$/.test(payoff)) {
    return payoff;
  }
  const quoted = hook.notes?.match(/[""「『]([^""」』\n]{1,24})[""」』]/);
  return quoted?.[1]?.trim() ?? "";
}

function localizePressureLabel(
  lifecycle: ReturnType<typeof describeHookLifecycle>,
  language: "zh" | "en",
): string {
  if (lifecycle.overdue) {
    return language === "en" ? "overdue" : "已逾期";
  }
  if (lifecycle.readyToResolve) {
    return language === "en" ? "ready to pay off" : "可回收";
  }
  return language === "en" ? "stale" : "陈旧";
}

function warning(
  language: "zh" | "en",
  description: string,
  suggestion: string,
): AuditIssue {
  return {
    severity: "warning",
    category: language === "en" ? "Hook Debt" : "伏笔债务",
    description,
    suggestion,
  };
}
