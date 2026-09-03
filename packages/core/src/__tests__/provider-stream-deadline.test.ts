import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { AssistantMessage, Model } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  guardAssistantMessageStream,
} from "../llm/provider.js";

const MODEL = {
  id: "slow-model",
  name: "slow-model",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "https://example.invalid/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128_000,
  maxTokens: 4096,
} satisfies Model<"openai-completions">;

describe("guardAssistantMessageStream", () => {
  afterEach(() => {
    delete process.env.INKOS_LLM_FIRST_EVENT_TIMEOUT_MS;
    delete process.env.INKOS_LLM_STREAM_IDLE_TIMEOUT_MS;
  });

  it("ends a stream that never produces its first event", async () => {
    const guarded = guardAssistantMessageStream(
      MODEL,
      () => createAssistantMessageEventStream(),
      undefined,
      { firstEventTimeoutMs: 10 },
    );

    const events = [];
    for await (const event of guarded) events.push(event);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "error",
      reason: "error",
      error: {
        stopReason: "error",
      },
    });
    const first = events[0] as { error?: { errorMessage?: string } };
    expect(first.error?.errorMessage).toContain("模型「slow-model」");
    expect(first.error?.errorMessage).toContain("没有开始输出");
    expect(first.error?.errorMessage).not.toMatch(/produced no event within/i);
  });

  it("keeps environment overrides authoritative", async () => {
    process.env.INKOS_LLM_FIRST_EVENT_TIMEOUT_MS = "10";
    const guarded = guardAssistantMessageStream(
      MODEL,
      () => createAssistantMessageEventStream(),
      undefined,
      { firstEventTimeoutMs: 60_000 },
    );

    const events = [];
    for await (const event of guarded) events.push(event);

    const first = events[0] as { error?: { errorMessage?: string } };
    expect(first.error?.errorMessage).toContain("模型「slow-model」");
    expect(first.error?.errorMessage).toContain("没有开始输出");
    expect(first.error?.errorMessage).not.toMatch(/produced no event within/i);
  });

  it("keeps the interactive chat idle policy at 60s", async () => {
    expect(DEFAULT_STREAM_IDLE_TIMEOUT_MS).toBe(60_000);
    vi.useFakeTimers();
    const stream = createAssistantMessageEventStream();
    const guarded = guardAssistantMessageStream(MODEL, () => stream);
    const empty: AssistantMessage = {
      role: "assistant",
      content: [],
      api: MODEL.api,
      provider: MODEL.provider,
      model: MODEL.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };
    const events: Array<{ type?: string; error?: { errorMessage?: string } }> = [];
    const pending = (async () => {
      for await (const event of guarded) events.push(event);
    })();
    stream.push({ type: "start", partial: empty });

    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(events.some((event) => event.type === "error")).toBe(false);
      await vi.advanceTimersByTimeAsync(DEFAULT_STREAM_IDLE_TIMEOUT_MS - 1);
      expect(events.some((event) => event.type === "error")).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      const errorEvent = events.find((event) => event.type === "error");
      expect(errorEvent?.error?.errorMessage).toContain("模型「slow-model」");
      expect(errorEvent?.error?.errorMessage).toContain("60 秒");
      expect(errorEvent?.error?.errorMessage).toContain("流式兼容性");
      expect(errorEvent?.error?.errorMessage).not.toMatch(/produced no token/i);
    } finally {
      vi.useRealTimers();
    }
  });
});
