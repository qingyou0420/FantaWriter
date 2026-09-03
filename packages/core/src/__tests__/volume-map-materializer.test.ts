import { describe, expect, it, vi } from "vitest";
import {
  MAX_CHAPTERS_PER_CALL,
  MATERIALIZER_OVERALL_TIMEOUT_MS,
  MATERIALIZER_STREAM_IDLE_TIMEOUT_MS,
  VolumeMapMaterializer,
  VolumeMapWeaveError,
} from "../agents/volume-map-materializer.js";
import type { BookConfig } from "../models/book.js";
import { LLMStreamInactivityError } from "../llm/provider.js";
import {
  listedExactChapterNumbers,
  parseVolumeMapTree,
  volumeMapHasLockedVolumes,
} from "../utils/volume-map-tree.js";
import { ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE, ZUI_CI_PROSE_FIXTURE } from "./volume-map-tree.test.js";

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

function buildAgent(model = "test-model"): VolumeMapMaterializer {
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
    model,
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
      expect(numbers).toHaveLength(Math.min(numbers.length, MAX_CHAPTERS_PER_CALL));
      expect(numbers.length).toBeLessThanOrEqual(MAX_CHAPTERS_PER_CALL);
      return {
        content: chapterList(Math.min(...numbers), Math.max(...numbers)),
        usage: ZERO_USAGE,
      };
    });
}

const LOCKED_ZUI_CI = [
  "## 第1卷 冕旒（1-40章）",
  "Objective：酒楼站稳眼线。",
  "",
  "## 第2卷 棋枰（41-80章）",
  "Objective：旧案不可收回。",
  "",
  "## 第3卷 白羽（81-125章）",
  "Objective：公开对质。",
].join("\n");

describe("VolumeMapMaterializer", () => {
  it("locks 醉词 prose into 7 named volumes without writing chapter summaries", async () => {
    const agent = buildAgent();
    const chat = mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 260, chapterWordCount: 5000, title: "醉词" }),
      volumeMap: ZUI_CI_PROSE_FIXTURE,
      language: "zh",
      mode: "volumes",
    });

    expect(chat).not.toHaveBeenCalled();
    expect(result.step).toBe("volumes");
    expect(result.generatedChapterNumbers).toEqual([]);
    expect(result.moreRemaining).toBe(true);
    expect(result.nextBatchStart).toBe(1);
    expect(result.nextBatchEnd).toBe(10);
    const tree = parseVolumeMapTree(result.markdown);
    expect(volumeMapHasLockedVolumes(tree)).toBe(true);
    expect(tree.volumeCount).toBe(7);
    expect(listedExactChapterNumbers(tree)).toHaveLength(0);
    expect(tree.volumes.map((volume) => volume.title.replace(/^第\d+卷\s*/, ""))).toEqual(
      expect.arrayContaining(["冕旒", "棋枰", "白羽", "商陆", "醉生", "江山", "清溪"]),
    );
    expect(tree.volumes[0]?.startChapter).toBe(1);
    expect(tree.volumes[0]?.endChapter).toBe(40);
    expect(tree.volumes[6]?.endChapter).toBe(260);
    for (const volume of tree.volumes) {
      expect(volume.title).not.toContain("卷一埋");
      expect(volume.title).not.toContain("各卷OKR");
      expect(volume.title).not.toMatch(/第\d+程/);
    }
  });

  it("auto-weaves the 醉词 stub as volumes, not a 第N程 batch", async () => {
    const agent = buildAgent();
    const chat = mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 260, chapterWordCount: 5000, title: "醉词" }),
      volumeMap: ZUI_CI_PROSE_FIXTURE,
      language: "zh",
    });

    expect(chat).not.toHaveBeenCalled();
    expect(result.step).toBe("volumes");
    expect(parseVolumeMapTree(result.markdown).volumes.map((volume) => volume.title.replace(/^第\d+卷\s*/, ""))).toEqual([
      "冕旒", "棋枰", "白羽", "商陆", "醉生", "江山", "清溪",
    ]);
    expect(result.nextBatchStart).toBe(1);
    expect(result.nextBatchEnd).toBe(10);
  });

  it("re-locks a 第N程 even-split book from leftover 原架构笔记", async () => {
    const agent = buildAgent();
    const chat = mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 260, chapterWordCount: 5000, title: "醉词" }),
      volumeMap: ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE,
      language: "zh",
    });

    expect(chat).not.toHaveBeenCalled();
    expect(result.step).toBe("volumes");
    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumes.map((volume) => volume.title.replace(/^第\d+卷\s*/, ""))).toEqual([
      "冕旒", "棋枰", "白羽", "商陆", "醉生", "江山", "清溪",
    ]);
    expect(tree.volumes.map((volume) => [volume.startChapter, volume.endChapter])).toEqual([
      [1, 40],
      [41, 80],
      [81, 125],
      [126, 165],
      [166, 200],
      [201, 235],
      [236, 260],
    ]);
  });

  it("init never dumps all planned chapters — only locks the volume split", async () => {
    const agent = buildAgent();
    const chat = mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 12 }),
      volumeMap: [
        "## 第1卷 试炼（1-6章）",
        "Objective：站稳酒楼眼线。",
        "",
        "## 第2卷 反噬（7-12章）",
        "Objective：把旧案推到不可收回。",
      ].join("\n"),
      language: "zh",
      mode: "init",
    });

    expect(chat).not.toHaveBeenCalled();
    expect(result.step).toBe("volumes");
    expect(listedExactChapterNumbers(parseVolumeMapTree(result.markdown))).toHaveLength(0);
    expect(result.moreRemaining).toBe(true);
  });

  it("remaining/full still only weave the next 10 chapters, not the rest of the book", async () => {
    const agent = buildAgent();
    const chat = mockChapterChat(agent);

    const remaining = await agent.materialize({
      book: book({ targetChapters: 260, title: "醉词" }),
      volumeMap: LOCKED_ZUI_CI,
      language: "zh",
      mode: "remaining",
    });
    expect(remaining.step).toBe("batch");
    expect(remaining.generatedChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(listedExactChapterNumbers(parseVolumeMapTree(remaining.markdown))).toEqual(remaining.generatedChapterNumbers);
    expect(chat).toHaveBeenCalledTimes(1);

    const full = await agent.materialize({
      book: book({ targetChapters: 90 }),
      volumeMap: "## 第1卷 酒楼（1-30章）\nObjective：站稳眼线。\n\n## 第2卷 反噬（31-60章）\nObjective：旧案不可收回。\n\n## 第3卷 对质（61-90章）\nObjective：公开对质。",
      language: "zh",
      mode: "full",
    });
    expect(full.generatedChapterNumbers).toHaveLength(10);
    expect(full.generatedChapterNumbers[0]).toBe(1);
    expect(full.moreRemaining).toBe(true);
  });

  it("weaves one batch of 10 and keeps author-edited chapters", async () => {
    const agent = buildAgent();
    const chat = mockChapterChat(agent);

    const result = await agent.materialize({
      book: book({ targetChapters: 12 }),
      volumeMap: [
        "## 第1卷 试炼（1-12章）",
        "Objective：开局。",
        "## 第 1 章 入局",
        "作者改过的提要，不能丢。",
      ].join("\n"),
      language: "zh",
      mode: "batch",
    });

    expect(chat).toHaveBeenCalledTimes(1);
    const tree = parseVolumeMapTree(result.markdown);
    expect(tree.volumes[0]?.chapters[0]?.summary).toContain("作者改过的提要");
    expect(result.generatedChapterNumbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(listedExactChapterNumbers(tree)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(result.moreRemaining).toBe(true);
    expect(result.nextBatchStart).toBe(12);
  });

  it("passes idle and overall timeouts on the batch chat call", async () => {
    const agent = buildAgent();
    const chat = vi.spyOn(agent as unknown as { chat: (...args: unknown[]) => Promise<unknown> }, "chat")
      .mockResolvedValue({
        content: chapterList(1, 10),
        usage: ZERO_USAGE,
      });

    await agent.materialize({
      book: book({ targetChapters: 40 }),
      volumeMap: LOCKED_ZUI_CI,
      language: "zh",
      mode: "batch",
    });

    expect(chat.mock.calls[0]?.[1]).toMatchObject({
      streamIdleTimeoutMs: MATERIALIZER_STREAM_IDLE_TIMEOUT_MS,
      overallTimeoutMs: MATERIALIZER_OVERALL_TIMEOUT_MS,
    });
    expect(MATERIALIZER_STREAM_IDLE_TIMEOUT_MS).toBe(180_000);
    expect(MATERIALIZER_OVERALL_TIMEOUT_MS).toBeGreaterThan(240_000);
  });

  it("omits default max thinking on kimi-k3 weave batches", async () => {
    const agent = buildAgent("kimi-k3");
    const chat = vi.spyOn(agent as unknown as { chat: (...args: unknown[]) => Promise<unknown> }, "chat")
      .mockResolvedValue({
        content: chapterList(1, 10),
        usage: ZERO_USAGE,
      });

    await agent.materialize({
      book: book({ targetChapters: 40, title: "醉词" }),
      volumeMap: LOCKED_ZUI_CI,
      language: "zh",
      mode: "batch",
    });

    expect(chat.mock.calls[0]?.[1]).toMatchObject({
      extra: { reasoning_effort: "low" },
      overallTimeoutMs: MATERIALIZER_OVERALL_TIMEOUT_MS,
    });
  });

  it("aborts a stalled batch and names the 10-chapter range", async () => {
    const agent = buildAgent();
    vi.spyOn(agent as unknown as { chat: (...args: unknown[]) => Promise<unknown> }, "chat")
      .mockRejectedValue(new LLMStreamInactivityError("idle", 60_000));

    const progress: string[] = [];
    await expect(agent.materialize({
      book: book({ targetChapters: 40, title: "醉词" }),
      volumeMap: LOCKED_ZUI_CI,
      language: "zh",
      mode: "batch",
      onProgress: (event) => progress.push(event.message),
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(VolumeMapWeaveError);
      const weave = error as VolumeMapWeaveError;
      expect(weave.chapterStart).toBe(1);
      expect(weave.chapterEnd).toBe(10);
      expect(weave.volumeNumber).toBe(1);
      expect(weave.volumeCount).toBe(3);
      expect(weave.message).toContain("第1/3卷");
      expect(weave.message).toContain("冕旒");
      expect(weave.message).toContain("第1–10章");
      expect(weave.message).toContain("织卷超时，模型还在想");
      expect(weave.message).toContain("模型「test-model」");
      expect(weave.message).toContain("流式兼容性");
      expect(weave.message).not.toContain("第1/?卷");
      expect(weave.message).not.toContain("请求参数错误");
      expect(weave.message).not.toMatch(/produced no token/i);
      return true;
    });
    expect(progress.some((line) => line.includes("第1–10章") && line.includes("正在请求模型"))).toBe(true);
  });
});
