/**
 * Load default craft lists (OpenWrite Apache-2.0 merge) for post-write checks.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

export interface CraftPattern {
  readonly id: string;
  readonly name: string;
  readonly severity: "error" | "warning";
  readonly language: "zh" | "en" | "any";
  readonly regex?: string;
  readonly contains?: string;
  readonly words?: ReadonlyArray<string>;
  readonly description: string;
  readonly suggestion: string;
}

export interface CraftRuleSet {
  readonly version: number;
  readonly source: string;
  readonly patterns: ReadonlyArray<CraftPattern>;
}

interface CraftFileShape {
  readonly version?: number;
  readonly source?: string;
  readonly patterns?: ReadonlyArray<Partial<CraftPattern>>;
  readonly bans?: ReadonlyArray<Partial<CraftPattern>>;
}

function craftDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "craft");
}

function normalizePattern(raw: Partial<CraftPattern>, fallbackId: string): CraftPattern | undefined {
  const id = raw.id?.trim() || fallbackId;
  const name = raw.name?.trim();
  const description = raw.description?.trim();
  const suggestion = raw.suggestion?.trim();
  if (!name || !description || !suggestion) return undefined;
  if (!raw.regex && !raw.contains && !raw.words?.length) return undefined;
  return {
    id,
    name,
    severity: raw.severity === "warning" ? "warning" : "error",
    language: raw.language === "en" || raw.language === "any" ? raw.language : "zh",
    regex: raw.regex,
    contains: raw.contains,
    words: raw.words,
    description,
    suggestion,
  };
}

function loadCraftFile(fileName: string): CraftRuleSet {
  const raw = readFileSync(join(craftDir(), fileName), "utf-8");
  const parsed = yaml.load(raw) as CraftFileShape;
  const rows = [...(parsed.patterns ?? []), ...(parsed.bans ?? [])];
  const patterns = rows
    .map((row, index) => normalizePattern(row, `${fileName}-${index}`))
    .filter((row): row is CraftPattern => Boolean(row));
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    source: parsed.source ?? fileName,
    patterns,
  };
}

let cached: ReadonlyArray<CraftPattern> | undefined;

export function loadDefaultCraftPatterns(): ReadonlyArray<CraftPattern> {
  if (cached) return cached;
  const ai = loadCraftFile("ai_patterns.yaml");
  const human = loadCraftFile("humanization.yaml");
  cached = [...ai.patterns, ...human.patterns];
  return cached;
}

export function matchCraftPatterns(
  content: string,
  language: "zh" | "en",
  patterns: ReadonlyArray<CraftPattern> = loadDefaultCraftPatterns(),
): ReadonlyArray<CraftPattern & { readonly matched: string }> {
  const hits: Array<CraftPattern & { readonly matched: string }> = [];
  for (const pattern of patterns) {
    if (pattern.language !== "any" && pattern.language !== language) continue;
    if (pattern.contains && content.includes(pattern.contains)) {
      hits.push({ ...pattern, matched: pattern.contains });
      continue;
    }
    if (pattern.regex) {
      const regex = new RegExp(pattern.regex, "g");
      if (regex.test(content)) {
        hits.push({ ...pattern, matched: pattern.name });
        continue;
      }
    }
    if (pattern.words) {
      const found = pattern.words.filter((word) => content.includes(word));
      if (found.length > 0) {
        hits.push({ ...pattern, matched: found.join("、") });
      }
    }
  }
  return hits;
}
