import { describe, expect, it } from "vitest";
import { exportProjectJson, importProjectJson } from "./storage";
import { flattenTreeChapterIds, syncOutlineTree } from "./outline-tree";
import { applySchemaV3 } from "./studio-v3";
import {
  CURRENT_SCHEMA_VERSION,
  createEmptyProject,
  normalizeProject,
  type CharacterStateLedger,
  type NovelProject,
  type OutlineChapter,
} from "./types";

function v2Sample(): NovelProject {
  const id = "book-v2-full";
  const volId = `${id}:vol:1`;
  const chapters: OutlineChapter[] = [
    {
      id: "ch-keep-1",
      volumeId: volId,
      order: 1,
      title: "霜桥",
      summary: "离乡",
      keyPoints: "诀别",
      tags: ["成长"],
      hook: "谁在对岸",
      forbidList: ["无故穿越"],
      timePlace: "霜桥·黎明",
    },
    {
      id: "ch-keep-2",
      volumeId: volId,
      order: 2,
      title: "客栈",
      summary: "投宿",
      keyPoints: "旧识",
      tags: [],
    },
  ];
  const ledger: CharacterStateLedger = {
    沈烬: [
      { chapterOrder: 1, note: "左肩裂开，仍握刀", pinned: true },
      { chapterOrder: 2, note: "在客栈二楼醒着" },
    ],
  };
  return {
    id,
    name: "旧书全量样例",
    schemaVersion: 2 as unknown as 3,
    writingBoard: "general",
    contentRating: "unrated",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    characters: [
      {
        id: "char-shen",
        name: "沈烬",
        gender: "男",
        age: "27",
        appearance: "左眉一道疤",
        personality: "克制",
        background: "边军逃卒",
        relationships: "与阿宁青梅",
        role: "主角",
        notes: "不喝酒",
        aliases: ["沈兄"],
        speechStyle: "短句",
      },
    ],
    background: {
      title: "霜桥记",
      synopsis: "逃卒回家",
      setting: "北境",
      era: "虚构中世",
      themes: "归乡",
      tone: "冷",
      extra: "雪不停",
    },
    lore: [
      {
        id: "lore-1",
        title: "霜桥",
        body: "第三块石缺了一角",
        keys: ["霜桥"],
        category: "place",
        enabled: true,
      },
    ],
    volumes: [
      {
        id: volId,
        order: 1,
        title: "第一卷",
        summary: "离乡",
        arcGoal: "活着走到南岸",
        exitState: "沈烬弃刀",
        timelineAnchor: "雪年正月",
      },
    ],
    settings: {
      writingStyle: "plain",
      customStyle: "",
      learnedStyleId: "",
      learnedStyleGuide: "",
      learnedStyleName: "",
      person: "third",
      length: "medium",
      language: "zh",
      chapterCount: 12,
      extraInstructions: "",
      serialMode: true,
    },
    tags: ["成长"],
    archivedActTags: [],
    original: null,
    canon: [
      {
        id: "fact-1",
        name: "沈烬",
        kind: "character",
        statement: "左肩旧伤无法举过顶",
        locked: true,
        aliases: ["沈兄"],
      },
    ],
    outline: {
      premise: "逃卒必须回家",
      endingNote: "弃刀",
      chapters,
    },
    chapters: [
      {
        chapterId: "ch-keep-1",
        title: "霜桥",
        content: "霜落在第三块缺角石上。沈烬没有回头。",
        status: "done",
        updatedAt: "2026-02-01T00:00:00.000Z",
        summary: "沈烬过桥，未回头。",
        touchedThreads: ["对岸人影"],
        reviewState: "reviewed",
        versions: [
          {
            id: "ver-1",
            content: "旧稿一句",
            createdAt: "2026-01-15T00:00:00.000Z",
            label: "auto",
          },
        ],
      },
      {
        chapterId: "ch-keep-2",
        title: "客栈",
        content: "",
        status: "idle",
        updatedAt: "",
      },
    ],
    plotThreads: [
      {
        id: "th-1",
        title: "对岸人影",
        note: "像阿宁",
        status: "active",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        visibility: "reader_known",
        kind: "foreshadow",
      },
    ],
    bookJob: {
      id: "job-1",
      status: "paused",
      items: [
        {
          chapterId: "ch-keep-2",
          order: 2,
          title: "客栈",
          status: "pending",
        },
      ],
      currentChapterId: null,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      mode: "missing",
    },
    lastConsistencyReport: {
      at: "2026-02-01T12:00:00.000Z",
      score: 82,
      summary: "称呼稳定",
      issues: [
        {
          severity: "medium",
          detail: "客栈店主姓名前后不一",
          suggestion: "统一为老周",
          character: "店主",
          chapter: "2",
        },
      ],
      coveredUpTo: 1,
    },
    characterStates: ledger,
    premiseCard: {
      premise: "逃卒必须回家",
      theme: "放下刀",
      endingDirection: "弃刀而不死",
      forbidList: ["无故穿越"],
      coreConflict: "回家与旧职",
    },
    accountRepairMarks: [
      { afterChapterOrder: 1, at: "2026-02-01T00:00:00.000Z", kind: "summary" },
    ],
  };
}

describe("v2 → v3 migration", () => {
  it("keeps chapter order, body, and ledger byte-identical", () => {
    const raw = v2Sample();
    const body1 = raw.chapters[0].content;
    const ledgerJson = JSON.stringify(raw.characterStates);
    const orders = raw.outline!.chapters.map((c) => ({ id: c.id, order: c.order }));

    const migrated = normalizeProject(raw);

    expect(CURRENT_SCHEMA_VERSION).toBe(3);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.chapters[0].content).toBe(body1);
    expect(migrated.chapters[0].chapterId).toBe("ch-keep-1");
    expect(migrated.outline?.chapters.map((c) => ({ id: c.id, order: c.order }))).toEqual(
      orders
    );
    expect(JSON.stringify(migrated.characterStates)).toBe(ledgerJson);
    expect(migrated.characters[0].confirmed).toBe(true);
    expect(migrated.currentFocus?.source).toBe("migrated");
    expect(migrated.currentFocus?.stageGoal).toContain("迁移生成，请修改");
    expect(migrated.outlineTree?.[0].acts[0].title).toBe("第一幕");
    expect(flattenTreeChapterIds(migrated.outlineTree)).toEqual([
      "ch-keep-1",
      "ch-keep-2",
    ]);
    expect(migrated.reviews?.[0].source).toBe("legacy_consistency");
    expect(migrated.chapters[0].reviewState).toBe("reviewed");
    expect(migrated.bookJob?.id).toBe("job-1");
    expect(migrated.canon?.[0].statement).toBe("左肩旧伤无法举过顶");
  });

  it("is idempotent and export/import stays lossless", () => {
    const once = normalizeProject(v2Sample());
    const twice = normalizeProject(once);
    expect(twice.chapters[0].content).toBe(once.chapters[0].content);
    expect(JSON.stringify(twice.characterStates)).toBe(
      JSON.stringify(once.characterStates)
    );
    expect(twice.outline?.chapters.map((c) => c.id)).toEqual(
      once.outline?.chapters.map((c) => c.id)
    );

    const json = exportProjectJson(once);
    const imported = normalizeProject(JSON.parse(json) as NovelProject);
    expect(imported.chapters[0].content).toBe(once.chapters[0].content);
    expect(imported.outline?.chapters.map((c) => c.order)).toEqual([1, 2]);
    expect(JSON.stringify(imported.characterStates)).toBe(
      JSON.stringify(once.characterStates)
    );
  });

  it("appending ten outline chapters does not rewrite old ids or orders", () => {
    const migrated = normalizeProject(v2Sample());
    const extras: OutlineChapter[] = Array.from({ length: 10 }, (_, i) => ({
      id: `ch-new-${i + 3}`,
      volumeId: migrated.volumes![0].id,
      order: i + 3,
      title: `新${i + 3}`,
      summary: "",
      keyPoints: "",
      tags: [],
    }));
    const nextChapters = [...(migrated.outline?.chapters || []), ...extras];
    const tree = syncOutlineTree(
      migrated.outlineTree,
      migrated.volumes,
      nextChapters,
      migrated.volumes![0].id
    );
    expect(nextChapters[0].id).toBe("ch-keep-1");
    expect(nextChapters[0].order).toBe(1);
    expect(nextChapters[1].id).toBe("ch-keep-2");
    expect(nextChapters[1].order).toBe(2);
    expect(flattenTreeChapterIds(tree).slice(0, 2)).toEqual([
      "ch-keep-1",
      "ch-keep-2",
    ]);
    expect(flattenTreeChapterIds(tree)).toHaveLength(12);
  });

  it("applySchemaV3 on a blank new project stays schema 3", () => {
    const p = applySchemaV3(createEmptyProject("新"));
    expect(p.schemaVersion).toBe(3);
    expect(p.outlineTree?.[0].acts[0].sections[0].chapters).toEqual([]);
  });
});

describe("importProjectJson v2 payload", () => {
  it("runs the same migration and assigns a new id", () => {
    const raw = v2Sample();
    const imported = importProjectJson(JSON.stringify(raw));
    expect(imported.id).not.toBe(raw.id);
    expect(imported.schemaVersion).toBe(3);
    expect(imported.chapters[0].content).toBe(raw.chapters[0].content);
    expect(imported.outline?.chapters[0].id).toBe("ch-keep-1");
  });
});
