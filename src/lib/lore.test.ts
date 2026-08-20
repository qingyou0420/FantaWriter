import { describe, expect, it } from "vitest";
import {
  formatLoreBlock,
  loreEntryChars,
  LORE_MAX_CHARS,
  LORE_MAX_ENTRIES,
  selectLoreForPrompt,
} from "./lore";
import { buildMemoryPack } from "./memory-pack";
import { createEmptyProject, type LoreEntry } from "./types";

function entry(
  partial: Partial<LoreEntry> & Pick<LoreEntry, "id" | "title" | "keys">
): LoreEntry {
  return {
    body: "",
    category: "other",
    enabled: true,
    ...partial,
  };
}

describe("selectLoreForPrompt", () => {
  it("includes enabled entries whose keys hit chapter text (case-insensitive)", () => {
    const hits = selectLoreForPrompt(
      {
        lore: [
          entry({ id: "1", title: "北境", keys: ["Winterfell"], body: "城堡" }),
          entry({ id: "2", title: "南境", keys: ["Dorne"], body: "沙漠" }),
        ],
      },
      "They rode to winterfell at dawn"
    );
    expect(hits.map((e) => e.id)).toEqual(["1"]);
    expect(formatLoreBlock(hits)).toContain("北境");
    expect(formatLoreBlock(hits)).not.toContain("南境");
  });

  it("skips disabled entries even on a key hit", () => {
    const hits = selectLoreForPrompt(
      {
        lore: [
          entry({
            id: "1",
            title: "禁",
            keys: ["magic"],
            enabled: false,
            body: "x",
          }),
        ],
      },
      "magic fills the hall"
    );
    expect(hits).toEqual([]);
  });

  it("caps at 8 matching entries", () => {
    const lore = Array.from({ length: 12 }, (_, i) =>
      entry({
        id: `l${i}`,
        title: `T${i}`,
        keys: ["rune"],
        body: "b",
      })
    );
    const hits = selectLoreForPrompt({ lore }, "a rune on the gate");
    expect(hits).toHaveLength(LORE_MAX_ENTRIES);
    expect(hits[0].id).toBe("l0");
    expect(hits[7].id).toBe("l7");
  });

  it("truncates so title+body stay within 2000 chars", () => {
    const lore = [
      entry({
        id: "big",
        title: "Big",
        keys: ["key"],
        body: "字".repeat(3000),
      }),
    ];
    const hits = selectLoreForPrompt({ lore }, "key");
    expect(hits).toHaveLength(1);
    expect(loreEntryChars(hits[0])).toBeLessThanOrEqual(LORE_MAX_CHARS);
    expect(hits[0].body.length).toBe(LORE_MAX_CHARS - "Big".length);
  });
});

describe("buildMemoryPack lore injection", () => {
  it("puts hitting lore into priorBlock under 世界观设定", () => {
    const p = createEmptyProject("设定测", "general");
    p.lore = [
      entry({
        id: "city",
        title: "灰港",
        keys: ["灰港"],
        category: "place",
        body: "雾中港口",
      }),
    ];
    p.outline = {
      premise: "",
      endingNote: "",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "抵达灰港",
          summary: "主角入城",
          keyPoints: "",
          eroticNote: "",
          tags: [],
        },
      ],
    };
    const pack = buildMemoryPack(p, 1);
    expect(pack.lore).toContain("灰港");
    expect(pack.priorBlock).toContain("## 世界观设定（关键词命中）");
    expect(pack.priorBlock).toContain("雾中港口");
  });
});
