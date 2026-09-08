/**
 * Author-facing copy. Never show raw engine tokens in UI.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
  humanizeReviewText,
  isHealthyReviewNoise,
  mapReviewCategory,
  toAuthorFacingReviewIssue,
  type ReviewCopyIssue,
} from "@actalk/inkos-core/review-author-copy";

const SEVERITY_ZH: Record<string, string> = {
  critical: "须处理",
  error: "须处理",
  blocking: "须处理",
  warning: "建议",
  warn: "建议",
  suggestion: "建议",
  info: "建议",
  minor: "建议",
};

const SEVERITY_EN: Record<string, string> = {
  critical: "Must fix",
  error: "Must fix",
  blocking: "Must fix",
  warning: "Suggestion",
  warn: "Suggestion",
  suggestion: "Suggestion",
  info: "Suggestion",
  minor: "Suggestion",
};

export {
  humanizeReviewText,
  isHealthyReviewNoise,
  toAuthorFacingReviewIssue,
};

const PLATFORM_LABELS: Record<string, { readonly zh: string; readonly en: string }> = {
  tomato: { zh: "番茄小说", en: "Tomato" },
  qidian: { zh: "起点中文网", en: "Qidian" },
  feilu: { zh: "飞卢", en: "Feilu" },
  other: { zh: "其他", en: "Other" },
};

export const GROUND_PLATFORM_VALUES = ["tomato", "qidian", "feilu", "other"] as const;

export function platformLabel(platform: string, isZh: boolean): string {
  const mapped = PLATFORM_LABELS[platform];
  if (mapped) return isZh ? mapped.zh : mapped.en;
  return platform.trim() || (isZh ? "其他" : "Other");
}

const HIDDEN_TOKENS = /\b(G1|Objective|Key Results?|audit-failed|critical)\b/gi;

export function mapAuditSeverity(severity: string, isZh: boolean): string {
  const key = severity.trim().toLowerCase();
  if (isZh) return SEVERITY_ZH[key] ?? (key === "critical" ? "须处理" : "建议");
  return SEVERITY_EN[key] ?? (key === "critical" ? "Must fix" : "Suggestion");
}

export function mapAuditCategory(category: string, isZh: boolean): string {
  return mapReviewCategory(category, isZh ? "zh" : "en");
}

export function humanizeReviewDescription(text: string, isZh: boolean): string {
  return humanizeReviewText(text, isZh ? "zh" : "en");
}

export function formatReviewIssueCopy(
  issue: ReviewCopyIssue,
  isZh: boolean,
): { readonly severity: string; readonly category: string; readonly description: string } | null {
  const facing = toAuthorFacingReviewIssue(issue, isZh ? "zh" : "en");
  if (!facing) return null;
  return {
    severity: mapAuditSeverity(issue.severity, isZh),
    category: facing.category,
    description: facing.description,
  };
}

export function isMustFixSeverity(severity: string): boolean {
  const key = severity.trim().toLowerCase();
  return key === "critical" || key === "error" || key === "blocking";
}

export function stripEngineTokens(text: string): string {
  return text.replace(HIDDEN_TOKENS, "").replace(/\s{2,}/g, " ").trim();
}

export function formatVolumeArriveCopy(okr: string, isZh: boolean): {
  readonly arrive: string;
  readonly mustLand: string;
} {
  const lines = okr.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const objective = lines.find((line) => /^(?:Objective|本卷要抵达)\s*[:：]/i.test(line));
  const results = lines.filter((line) => /^(?:Key\s*Results?|KR\s*\d+|卷末必须落下|关键成果|关键结果)\s*[:：=]/i.test(line));
  const arrive = (objective ?? lines[0] ?? "")
    .replace(/^(?:Objective|本卷要抵达)\s*[:：]\s*/i, "")
    .trim();
  const mustLand = results
    .map((line) => line.replace(/^(?:Key\s*Results?|KR\s*\d+|卷末必须落下|关键成果|关键结果)\s*[:：=]\s*/i, "").trim())
    .filter(Boolean)
    .join(isZh ? "；" : "; ");
  return { arrive, mustLand };
}

export function shortChapterTitle(title: string, max = 12): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}`;
}

export function hasPreviousChapterUnapprovedReason(
  reasons: ReadonlyArray<{ readonly code?: string; readonly message?: string; readonly messageZh?: string }>,
): boolean {
  return reasons.some((reason) => {
    if (reason.code === "previous_chapter_not_approved") return true;
    const text = `${reason.messageZh ?? ""} ${reason.message ?? ""}`;
    return /上一章/.test(text) && /未通过|尚未通过|not approved/i.test(text);
  });
}

const TRUTH_FILE_LABELS: Record<string, { readonly zh: string; readonly en: string }> = {
  "outline/story_frame.md": { zh: "故事框架", en: "Story frame" },
  "story/outline/story_frame.md": { zh: "故事框架", en: "Story frame" },
  "outline/volume_map.md": { zh: "卷纲规划", en: "Volume map" },
  "pending_hooks.md": { zh: "伏笔清单", en: "Hook list" },
  "current_state.md": { zh: "当前状态", en: "Current state" },
  "open_questions.md": { zh: "待定项", en: "Open questions" },
  "emotional_arcs.md": { zh: "情感弧线", en: "Emotional arcs" },
  "subplot_board.md": { zh: "支线进度", en: "Subplot board" },
};

export function mapTruthFileLabel(fileName: string, isZh: boolean): string {
  const normalized = fileName.replace(/^\/+/, "");
  const mapped = TRUTH_FILE_LABELS[normalized];
  if (mapped) return isZh ? mapped.zh : mapped.en;
  const role = normalized.match(/^roles\/(主要角色|次要角色|major|minor)\/(.+)\.md$/);
  if (role) {
    const name = role[2];
    return isZh ? `人物 · ${name}` : `Character · ${name}`;
  }
  const base = normalized.split("/").pop()?.replace(/\.md$/, "") ?? normalized;
  return base;
}

export function countUnifiedDiffLines(diff: string): { readonly added: number; readonly removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    else if (line.startsWith("-")) removed += 1;
  }
  return { added, removed };
}
