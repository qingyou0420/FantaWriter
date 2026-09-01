/**
 * G5 approve gate: critical audit issues block chapter approval unless an
 * explicit override is recorded on chapter meta.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { AuditIssue, AuditResult } from "../agents/continuity.js";
import type { ChapterMeta } from "../models/chapter.js";
import { chapterRuntimeSlug } from "../utils/packet-snapshot.js";

export const ApproveOverrideSchema = z.object({
  who: z.string().min(1),
  when: z.string().datetime(),
  why: z.string().min(1),
});

export type ApproveOverride = z.infer<typeof ApproveOverrideSchema>;

export class ApproveBlockedError extends Error {
  readonly code = "APPROVE_BLOCKED";
  constructor(
    readonly chapterNumber: number,
    readonly criticalCount: number,
    readonly issues: ReadonlyArray<AuditIssue>,
  ) {
    super(`Chapter ${chapterNumber} has ${criticalCount} critical audit issue(s) and cannot be approved without an explicit override.`);
    this.name = "ApproveBlockedError";
  }
}

export interface ReviewQueueItem {
  readonly chapterNumber: number;
  readonly title: string;
  readonly status: string;
  readonly severity: AuditIssue["severity"];
  readonly category: string;
  readonly description: string;
  readonly suggestion: string;
}

export function parseAuditIssueLine(line: string): Pick<AuditIssue, "severity" | "category" | "description" | "suggestion"> | undefined {
  const match = /^\[(critical|warning|info)\]\s*(.*)$/i.exec(line.trim());
  if (!match) return undefined;
  const severity = match[1]!.toLowerCase() as AuditIssue["severity"];
  const rest = match[2] ?? "";
  const categorySplit = /^([^:：]+)[:：]\s*(.+)$/.exec(rest);
  return {
    severity,
    category: categorySplit?.[1]?.trim() || "audit",
    description: (categorySplit?.[2] ?? rest).trim(),
    suggestion: "",
  };
}

export function collectCriticalIssues(params: {
  readonly chapter: ChapterMeta;
  readonly audit?: Pick<AuditResult, "issues">;
}): AuditIssue[] {
  if (params.audit?.issues?.length) {
    return params.audit.issues.filter((issue) => issue.severity === "critical");
  }
  return params.chapter.auditIssues
    .map((line) => parseAuditIssueLine(line))
    .filter((issue): issue is NonNullable<typeof issue> => issue?.severity === "critical")
    .map((issue) => ({
      severity: issue.severity,
      category: issue.category,
      description: issue.description,
      suggestion: issue.suggestion,
    }));
}

export function assertChapterApprovable(params: {
  readonly chapter: ChapterMeta;
  readonly audit?: Pick<AuditResult, "issues">;
  readonly override?: ApproveOverride;
}): void {
  const critical = collectCriticalIssues(params);
  if (critical.length === 0) return;
  if (params.override && params.override.why.trim()) return;
  throw new ApproveBlockedError(params.chapter.number, critical.length, critical);
}

export function applyApproveOverride(
  chapter: ChapterMeta,
  override: ApproveOverride,
): ChapterMeta {
  return {
    ...chapter,
    status: "approved",
    updatedAt: override.when,
    approveOverride: override,
  };
}

export async function writeChapterAuditSnapshot(params: {
  readonly bookDir: string;
  readonly chapterNumber: number;
  readonly auditResult: AuditResult;
}): Promise<string> {
  const runtimeDir = join(params.bookDir, "story", "runtime");
  await mkdir(runtimeDir, { recursive: true });
  const path = join(runtimeDir, `${chapterRuntimeSlug(params.chapterNumber)}.audit.json`);
  await writeFile(path, JSON.stringify(params.auditResult, null, 2), "utf-8");
  return path;
}

export async function readChapterAuditSnapshot(
  bookDir: string,
  chapterNumber: number,
): Promise<AuditResult | undefined> {
  try {
    const raw = await readFile(
      join(bookDir, "story", "runtime", `${chapterRuntimeSlug(chapterNumber)}.audit.json`),
      "utf-8",
    );
    return JSON.parse(raw) as AuditResult;
  } catch {
    return undefined;
  }
}

export async function buildReviewQueue(params: {
  readonly bookDir: string;
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly severity?: AuditIssue["severity"];
  readonly chapterNumber?: number;
}): Promise<ReadonlyArray<ReviewQueueItem>> {
  const items: ReviewQueueItem[] = [];
  for (const chapter of params.chapters) {
    if (params.chapterNumber !== undefined && chapter.number !== params.chapterNumber) continue;
    const audit = await readChapterAuditSnapshot(params.bookDir, chapter.number);
    const issues = audit?.issues?.length
      ? audit.issues
      : chapter.auditIssues
        .map((line) => parseAuditIssueLine(line))
        .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue))
        .map((issue) => ({
          severity: issue.severity,
          category: issue.category,
          description: issue.description,
          suggestion: issue.suggestion,
        }));
    for (const issue of issues) {
      if (params.severity && issue.severity !== params.severity) continue;
      items.push({
        chapterNumber: chapter.number,
        title: chapter.title,
        status: chapter.status,
        severity: issue.severity,
        category: issue.category,
        description: issue.description,
        suggestion: issue.suggestion,
      });
    }
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return items.sort((left, right) => {
    const severityDelta = rank[left.severity] - rank[right.severity];
    if (severityDelta !== 0) return severityDelta;
    return left.chapterNumber - right.chapterNumber;
  });
}
