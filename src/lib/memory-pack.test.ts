import { describe, expect, it } from "vitest";
import {
  buildCharacterStateCard,
  buildMemoryPack,
  formatVolumeMemory,
} from "./memory-pack";
import { createEmptyCharacter, createEmptyProject } from "./types";

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
});
