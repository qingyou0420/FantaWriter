/**
 * Author-facing copy. Never show raw engine tokens in UI.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

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

const CATEGORY_ZH: Record<string, string> = {
  continuity: "连贯性",
  character: "人物",
  characters: "人物",
  timeline: "时间线",
  world: "世界规则",
  "world-rule": "世界规则",
  lore: "世界规则",
  style: "文风",
  voice: "文风",
  hook: "伏笔",
  plot: "情节",
};

const CATEGORY_EN: Record<string, string> = {
  continuity: "Continuity",
  character: "Character",
  characters: "Character",
  timeline: "Timeline",
  world: "World rules",
  "world-rule": "World rules",
  lore: "World rules",
  style: "Style",
  voice: "Voice",
  hook: "Hook",
  plot: "Plot",
};

const HIDDEN_TOKENS = /\b(G1|Objective|Key Results?|audit-failed|critical)\b/gi;

export function mapAuditSeverity(severity: string, isZh: boolean): string {
  const key = severity.trim().toLowerCase();
  if (isZh) return SEVERITY_ZH[key] ?? (key === "critical" ? "须处理" : "建议");
  return SEVERITY_EN[key] ?? (key === "critical" ? "Must fix" : "Suggestion");
}

export function mapAuditCategory(category: string, isZh: boolean): string {
  const key = category.trim().toLowerCase();
  if (isZh) return CATEGORY_ZH[key] ?? category;
  return CATEGORY_EN[key] ?? category;
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

export function splitLongOutlineTitle(title: string, summary: string): {
  readonly title: string;
  readonly summary: string;
  readonly split: boolean;
} {
  const trimmedTitle = title.trim();
  const trimmedSummary = summary.trim();
  if (trimmedTitle.length <= 20 || trimmedSummary) {
    return { title: trimmedTitle, summary: summary, split: false };
  }
  const mark = trimmedTitle.search(/[，。；→]/);
  if (mark <= 0) {
    return { title: shortChapterTitle(trimmedTitle, 12), summary: trimmedTitle, split: true };
  }
  return {
    title: shortChapterTitle(trimmedTitle.slice(0, mark), 12),
    summary: trimmedTitle.slice(mark + 1).trim(),
    split: true,
  };
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
