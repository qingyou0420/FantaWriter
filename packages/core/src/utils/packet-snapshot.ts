/**
 * G2 governed packet snapshot. Protected sources are recorded in full;
 * compressible sources may already be budget-compressed by context-assembly.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChapterTrace, ContextPackage, RuleStack } from "../models/input-governance.js";
import { isProtectedContextSource } from "./context-assembly.js";

export interface PacketSourceRecord {
  readonly source: string;
  readonly reason: string;
  readonly excerpt: string;
  readonly tokens: number;
  readonly protected: boolean;
  readonly truncated: boolean;
  readonly compressed: boolean;
}

export interface GovernedPacketSnapshot {
  readonly schemaVersion: 1;
  readonly chapter: number;
  readonly createdAt: string;
  readonly contextPackage: ContextPackage;
  readonly ruleStack: RuleStack;
  readonly trace: ChapterTrace;
  readonly sources: ReadonlyArray<PacketSourceRecord>;
  readonly tokenBudget: ChapterTrace["tokenBudget"];
  readonly protectedNeverTruncated: true;
}

export function chapterRuntimeSlug(chapterNumber: number): string {
  return `chapter-${String(chapterNumber).padStart(4, "0")}`;
}

export function packetSnapshotRelativePath(chapterNumber: number): string {
  return join("story", "runtime", `${chapterRuntimeSlug(chapterNumber)}.packet.json`);
}

export function buildGovernedPacketSnapshot(params: {
  readonly chapterNumber: number;
  readonly contextPackage: ContextPackage;
  readonly ruleStack: RuleStack;
  readonly trace: ChapterTrace;
  readonly createdAt?: string;
}): GovernedPacketSnapshot {
  const compressedSources = new Set(params.trace.compression?.compressedSources ?? []);
  const sources = params.contextPackage.selectedContext.map((entry) => {
    const protectedSource = isProtectedContextSource(entry.source);
    const excerpt = entry.excerpt ?? "";
    return {
      source: entry.source,
      reason: entry.reason,
      excerpt,
      tokens: estimateTextTokens([entry.source, entry.reason, excerpt].filter(Boolean).join("\n")),
      protected: protectedSource,
      truncated: false,
      compressed: !protectedSource && compressedSources.has(entry.source),
    } satisfies PacketSourceRecord;
  });

  return {
    schemaVersion: 1,
    chapter: params.chapterNumber,
    createdAt: params.createdAt ?? new Date().toISOString(),
    contextPackage: params.contextPackage,
    ruleStack: params.ruleStack,
    trace: params.trace,
    sources,
    tokenBudget: params.trace.tokenBudget,
    protectedNeverTruncated: true,
  };
}

export async function writeGovernedPacketSnapshot(params: {
  readonly runtimeDir: string;
  readonly chapterNumber: number;
  readonly contextPackage: ContextPackage;
  readonly ruleStack: RuleStack;
  readonly trace: ChapterTrace;
}): Promise<string> {
  await mkdir(params.runtimeDir, { recursive: true });
  const packetPath = join(params.runtimeDir, `${chapterRuntimeSlug(params.chapterNumber)}.packet.json`);
  const snapshot = buildGovernedPacketSnapshot(params);
  await writeFile(packetPath, JSON.stringify(snapshot, null, 2), "utf-8");
  return packetPath;
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 2));
}
