import type { LoreEntry, NovelProject } from "./types";

export const LORE_MAX_ENTRIES = 8;
export const LORE_MAX_CHARS = 2000;

const CATEGORY_LABEL: Record<LoreEntry["category"], string> = {
  place: "地点",
  org: "组织",
  item: "物品",
  rule: "规则",
  other: "其他",
};

export function createEmptyLoreEntry(title = "新设定"): LoreEntry {
  return {
    id: crypto.randomUUID(),
    title,
    body: "",
    keys: [],
    category: "other",
    enabled: true,
  };
}

export function loreEntryChars(entry: LoreEntry): number {
  return (entry.title || "").length + (entry.body || "").length;
}

function haystackHasKey(haystack: string, key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  return haystack.includes(k);
}

/** keys 命中 chapterText 时入选；上限 8 条 / 合计 2000 字。 */
export function selectLoreForPrompt(
  project: Pick<NovelProject, "lore">,
  chapterText: string
): LoreEntry[] {
  const hay = (chapterText || "").toLowerCase();
  const pool = (project.lore || []).filter((e) => e.enabled !== false);
  const hits: LoreEntry[] = [];
  let chars = 0;
  for (const entry of pool) {
    const keys = entry.keys || [];
    const matched = keys.some((k) => haystackHasKey(hay, k));
    if (!matched) continue;
    if (hits.length >= LORE_MAX_ENTRIES) break;
    const size = loreEntryChars(entry);
    if (chars + size > LORE_MAX_CHARS) {
      const remain = LORE_MAX_CHARS - chars;
      if (remain <= (entry.title || "").length) break;
      hits.push({
        ...entry,
        body: (entry.body || "").slice(0, remain - (entry.title || "").length),
      });
      break;
    }
    hits.push(entry);
    chars += size;
  }
  return hits;
}

export function formatLoreBlock(entries: LoreEntry[]): string {
  if (!entries.length) return "";
  return entries
    .map((e) => {
      const cat = CATEGORY_LABEL[e.category] || e.category;
      return `- 【${cat}·${e.title}】${e.body || ""}`;
    })
    .join("\n");
}
