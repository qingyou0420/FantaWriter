import { describe, expect, it } from "vitest";
import {
  buildCharacterStateCard,
  buildMemoryPack,
  formatPlotThreads,
  formatVolumeMemory,
  isPlotThreadOverdue,
  plotThreadSuspension,
} from "./memory-pack";
import {
  createEmptyCharacter,
  createEmptyPlotThread,
  createEmptyProject,
} from "./types";

describe("character state card", () => {
  it("keeps recent clues and drops static character fields", () => {
    const chars = [
      {
        ...createEmptyCharacter(),
        name: "甲",
        role: "主角",
        gender: "男",
        age: "28",
        personality: "冷硬寡言",
        relationships: "乙的兄长",
        notes: "口癖少",
      },
    ];
    const card = buildCharacterStateCard(chars, ["第1章：甲在渡口受伤"]);
    expect(card).toContain("近期状态线索");
    expect(card).toContain("甲在渡口受伤");
    expect(card).not.toContain("定位:");
    expect(card).not.toContain("性格:");
    expect(card).not.toContain("冷硬寡言");
    expect(card).not.toContain("乙的兄长");
  });
});

describe("volume memory", () => {
  it("injects current volume theme and finished volume summaries", () => {
    const p = createEmptyProject("卷记忆");
    p.volumes = [
      { id: "v1", order: 1, title: "上卷", summary: "少年离乡，渡口定约。" },
      { id: "v2", order: 2, title: "中卷", summary: "朝堂与边关同时裂开。" },
    ];
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "上路",
          keyPoints: "",
          tags: [],
          volumeId: "v1",
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "入京",
          keyPoints: "",
          tags: [],
          volumeId: "v2",
        },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "正文",
        status: "done",
        updatedAt: "",
        summary: "甲离开渡口。",
      },
    ];

    const block = formatVolumeMemory(p.volumes, p.outline.chapters[1]);
    expect(block).toContain("本卷《中卷》");
    expect(block).toContain("朝堂与边关同时裂开");
    expect(block).toContain("已完成卷");
    expect(block).toContain("少年离乡");

    const pack = buildMemoryPack(p, 2);
    expect(pack.volumeMemory).toContain("中卷");
    expect(pack.priorBlock).toContain("分卷记忆");
    expect(pack.priorBlock).toContain("少年离乡");
    expect(pack.priorBlock).toContain("甲离开渡口");
  });

  it("uses volume summaries for distant finished volumes and chapter summaries for the recent window", () => {
    const p = createEmptyProject("分层记忆");
    p.volumes = [
      { id: "v1", order: 1, title: "上卷", summary: "远卷：少年离乡，渡口定约。" },
      { id: "v2", order: 2, title: "中卷", summary: "近卷：朝堂裂开。" },
    ];
    const chapters = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i + 1}`,
      order: i + 1,
      title: `第${i + 1}章`,
      summary: `大纲${i + 1}`,
      keyPoints: "",
      tags: [] as string[],
      volumeId: i < 4 ? "v1" : "v2",
    }));
    p.outline = { premise: "p", endingNote: "e", chapters };
    p.chapters = chapters.map((ch, i) => ({
      chapterId: ch.id,
      title: ch.title,
      content: i < 7 ? `正文${i + 1}` : "",
      status: i < 7 ? ("done" as const) : ("idle" as const),
      updatedAt: "",
      summary: i < 7 ? `章摘要${i + 1}：近窗细节。` : "",
    }));

    const pack = buildMemoryPack(p, 8);
    expect(pack.volumeMemory).toContain("远卷：少年离乡");
    expect(pack.volumeMemory).toContain("近卷：朝堂裂开");
    expect(pack.previousSummaries).toContain("章摘要7");
    expect(pack.previousSummaries).toContain("章摘要4");
    expect(pack.previousSummaries).not.toContain("章摘要2");
    expect(pack.priorBlock).toContain("分卷记忆");
    expect(pack.priorBlock).toContain("前情摘要");
  });
});

describe("character state ledger", () => {
  it("keeps chapter 40 injury on the card when generating chapter 46", () => {
    const chars = [
      { ...createEmptyCharacter(), name: "甲", role: "主角" },
    ];
    const card = buildCharacterStateCard(chars, ["第45章：甲在客栈过夜"], {
      甲: [
        { chapterOrder: 40, note: "左臂骨折" },
        { chapterOrder: 44, note: "改口叫师父" },
      ],
    });
    expect(card).toContain("【角色状态卡");
    expect(card).toContain("第40章 甲：左臂骨折");
    expect(card).toContain("第44章 甲：改口叫师父");
    expect(card).not.toContain("近期状态线索");
  });

  it("matches the old card when the ledger is empty", () => {
    const chars = [
      {
        ...createEmptyCharacter(),
        name: "甲",
        role: "主角",
        personality: "冷硬寡言",
      },
    ];
    const card = buildCharacterStateCard(chars, ["第1章：甲在渡口受伤"]);
    expect(card).toBe(
      [
        "【角色状态卡 — 近期状态线索（关注：甲）】",
        "请延续下列状态，勿无故重置称呼、伤势、关系与情绪。",
        "第1章：甲在渡口受伤",
      ].join("\n")
    );
  });

  it("puts a hand-edited summary into the memory pack", () => {
    const p = createEmptyProject("手改摘要");
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "大纲旧句",
          keyPoints: "",
          tags: [],
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "正文",
        status: "done",
        updatedAt: "",
        summary: "手改：甲改口叫师父，左臂还没好。",
      },
    ];
    const pack = buildMemoryPack(p, 2);
    expect(pack.previousSummaries).toContain("手改：甲改口叫师父，左臂还没好。");
    expect(pack.priorBlock).toContain("手改：甲改口叫师父，左臂还没好。");
  });
});

describe("plot thread injection and suspension", () => {
  it("injects at most 12 open threads and always keeps named ones", () => {
    const named = {
      ...createEmptyPlotThread("指名主线"),
      id: "named",
      status: "active" as const,
      visibility: "reader_known" as const,
      kind: "main" as const,
    };
    const others = Array.from({ length: 19 }, (_, i) => ({
      ...createEmptyPlotThread(`开放线索${i + 1}`),
      id: `t${i + 1}`,
      status: "active" as const,
      visibility: "reader_known" as const,
      kind: "other" as const,
      updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    const text = formatPlotThreads([named, ...others], {
      namedThreadIds: ["named"],
    });
    const lines = text.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(text).toContain("指名主线");
    expect(text).toContain("其余 8 条未列出，见伏笔板");
  });

  it("marks threads planted more than 30 chapters ago as overdue", () => {
    const orderById = new Map([["plant", 2]]);
    const thread = {
      ...createEmptyPlotThread("旧线"),
      plantChapterId: "plant",
      status: "active" as const,
    };
    expect(plotThreadSuspension(thread, orderById, 40)).toBe(38);
    expect(isPlotThreadOverdue(thread, orderById, 40)).toBe(true);
    expect(isPlotThreadOverdue(thread, orderById, 20)).toBe(false);
    expect(
      isPlotThreadOverdue(
        { ...thread, dueChapterOrder: 10 },
        orderById,
        10
      )
    ).toBe(true);
  });
});
