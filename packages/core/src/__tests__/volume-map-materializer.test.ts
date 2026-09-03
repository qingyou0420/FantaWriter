import { describe, expect, it, vi } from "vitest";
import { VolumeMapMaterializer } from "../agents/volume-map-materializer.js";
import type { BookConfig } from "../models/book.js";
import { listedExactChapterNumbers, parseVolumeMapTree, volumeMapHasReviewableTree } from "../utils/volume-map-tree.js";
import { findVolumeMapEntry } from "../utils/volume-map-entry.js";
import { ZUI_CI_PROSE_FIXTURE } from "./volume-map-tree.test.js";

const ZERO_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
} as const;

function book(overrides: Partial<BookConfig> = {}): BookConfig {
  return {
    id: "outline-book",
    title: "醉词",
    platform: "other",
    genre: "urban",
    status: "outlining",
    targetChapters: 12,
    chapterWordCount: 3000,
    language: "zh",
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

function buildAgent(): VolumeMapMaterializer {
  return new VolumeMapMaterializer({
    client: {
      provider: "openai",
      apiFormat: "chat",
      stream: false,
      defaults: {
        temperature: 0.6,
        maxTokens: 4096,
        thinkingBudget: 0,
        maxTokensCap: null,
        extra: {},
      },
    },
    model: "test-model",
    projectRoot: process.cwd(),
  });
}

function chapterList(start: number, end: number): string {
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const number = start + index;
    return `## 第 ${number} 章 节点${number}\n推进本卷到节点${number}。`;
  }).join("\n");
}

function mockChapterChat(agent: VolumeMapMaterializer) {
  return vi.spyOn(agent as unknown as { chat: (...args: unknown[]) => Promise<unknown> }, "chat")
    .mockImplementation(async (...args: unknown[]) => {
      const messages = args[0] as Array<{ content?: string }>;
      const system = messages[0]?.content ?? "";
      const match = system.match(/必须写全这些章号：([0-9、]+)/);
      const numbers = (match?.[1] ?? "1").split("、").map((item) => Number.parseInt(item, 10));
      return {
        content: chapterList(Math.min(...numbers), Math.max(...numbers)),
        usage: ZERO_USAGE,
      };
    });
}

describe("VolumeMapMaterializer", () => {
  it("turns architect volume skeleton + targetChapters into a parseable tree", async () => {
    const agent = buildAgent();
    mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 12 }),
      storyFrame: "## 主题\n酒楼旧案。",
      volumeMap: [
        "## 第1卷 试炼（1-6章）",
        "Objective：站稳酒楼眼线。",
        "KR1 = 拿到醉词令残页",
        "",
        "## 第2卷 反噬（7-12章）",
        "Objective：把旧案推到不可收回。",
      ].join("\n"),
      language: "zh",
      mode: "init",
    });

    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumeCount).toBe(2);
    expect(listedExactChapterNumbers(tree)).toHaveLength(12);
    expect(volumeMapHasReviewableTree(tree, 12)).toBe(true);
    expect(findVolumeMapEntry(result.markdown, 1)).toContain("节点1");
    expect(tree.volumes[0]?.chapters[0]?.title).toBe("节点1");
    expect(tree.volumes[0]?.title.length).toBeLessThanOrEqual(22);
    expect(tree.volumes[0]?.title).not.toContain("KR1");
  });

  it("rebuilds a chapter tree from 醉词 prose without using that prose as a title", async () => {
    const agent = buildAgent();
    mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 24, title: "醉词" }),
      volumeMap: ZUI_CI_PROSE_FIXTURE,
      language: "zh",
      mode: "full",
    });

    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumeCount).toBeGreaterThan(1);
    expect(listedExactChapterNumbers(tree)).toHaveLength(24);
    for (const volume of tree.volumes) {
      expect(volume.title).not.toContain("卷一埋");
      expect(volume.title).not.toContain("各卷OKR");
      expect(volume.title.length).toBeLessThanOrEqual(22);
    }
    expect(result.markdown).toMatch(/## 第 1 章/);
  });

  it("rebuilds 260 planned chapters from the 醉词 fixture without wall titles", async () => {
    const agent = buildAgent();
    mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 260, chapterWordCount: 5000, title: "醉词" }),
      volumeMap: ZUI_CI_PROSE_FIXTURE,
      language: "zh",
      mode: "full",
    });

    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumeCount).toBeGreaterThan(1);
    expect(listedExactChapterNumbers(tree)).toHaveLength(260);
    expect(volumeMapHasReviewableTree(tree, 260)).toBe(true);
    for (const volume of tree.volumes) {
      expect(volume.title).not.toContain("卷一埋");
      expect(volume.title).not.toContain("卷一Objective");
      expect(volume.title).not.toContain("各卷OKR");
      expect(volume.title.length).toBeLessThanOrEqual(22);
    }
    expect(findVolumeMapEntry(result.markdown, 1)).toBeTruthy();
    expect(findVolumeMapEntry(result.markdown, 260)).toBeTruthy();
    expect(tree.volumes.map((volume) => volume.title.replace(/^第\d+卷\s*/, ""))).toEqual(
      expect.arrayContaining(["冕琅", "棋梪", "白羽", "商陆", "醉生", "江山", "清溪"]),
    );
    expect(tree.volumeCount).toBe(7);
    expect(tree.volumes[0]?.startChapter).toBe(1);
    expect(tree.volumes[0]?.endChapter).toBe(40);
    expect(tree.volumes[6]?.endChapter).toBe(260);
  });

  it("materializes 90 chapters across multiple volumes", async () => {
    const agent = buildAgent();
    mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 90, chapterWordCount: 3000 }),
      volumeMap: "## 第1卷 酒楼（1-30章）\nObjective：站稳眼线。\n\n## 第2卷 反噬（31-60章）\nObjective：旧案不可收回。\n\n## 第3卷 对质（61-90章）\nObjective：公开对质。",
      language: "zh",
      mode: "init",
    });

    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumeCount).toBe(3);
    expect(listedExactChapterNumbers(tree)).toHaveLength(90);
    expect(volumeMapHasReviewableTree(tree, 90)).toBe(true);
    expect(findVolumeMapEntry(result.markdown, 1)).toBeTruthy();
    expect(findVolumeMapEntry(result.markdown, 90)).toBeTruthy();
  });

  it("preserves existing chapter entries when rematerializing remaining chapters", async () => {
    const agent = buildAgent();
    const chat = vi.spyOn(agent as unknown as { chat: (...args: unknown[]) => Promise<unknown> }, "chat")
      .mockResolvedValue({
        content: "## 第 2 章 续写\n只补缺的一章。",
        usage: ZERO_USAGE,
      });

    const result = await agent.materialize({
      book: book({ targetChapters: 2 }),
      volumeMap: [
        "## 第1卷 试炼（1-2章）",
        "Objective：开局。",
        "## 第 1 章 入局",
        "作者改过的提要，不能丢。",
      ].join("\n"),
      language: "zh",
      mode: "remaining",
    });

    expect(chat).toHaveBeenCalled();
    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumes[0]?.chapters[0]?.summary).toContain("作者改过的提要");
    expect(listedExactChapterNumbers(tree)).toEqual([1, 2]);
  });

  it("regenerates an empty 第 1 章 stub when weaving remaining chapters", async () => {
    const agent = buildAgent();
    mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 4 }),
      volumeMap: ZUI_CI_PROSE_FIXTURE,
      language: "zh",
      mode: "remaining",
    });

    const tree = parseVolumeMapTree(result.markdown);
    expect(listedExactChapterNumbers(tree)).toEqual([1, 2, 3, 4]);
    expect(tree.volumes[0]?.chapters[0]?.title).toBe("节点1");
    expect(tree.volumes[0]?.title).not.toContain("卷一埋");
  });
});
