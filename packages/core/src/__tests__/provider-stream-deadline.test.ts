import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { AssistantMessage, Model } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  formatLlmStreamTimeoutMessage,
  guardAssistantMessageStream,
  LLMStreamInactivityError,
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

function emptyAssistant(): AssistantMessage {
  return {
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
}

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

  it("keeps the default no-tool idle policy at 60s", async () => {
    expect(DEFAULT_STREAM_IDLE_TIMEOUT_MS).toBe(60_000);
    vi.useFakeTimers();
    const stream = createAssistantMessageEventStream();
    const guarded = guardAssistantMessageStream(MODEL, () => stream);
    const empty = emptyAssistant();
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
      expect(errorEvent?.error?.errorMessage).not.toContain("没有完成");
      expect(errorEvent?.error?.errorMessage).not.toMatch(/produced no token/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a tool-capable stream stay silent for 90s then finish write_truth_file", async () => {
    expect(DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS).toBe(180_000);
    vi.useFakeTimers();
    const stream = createAssistantMessageEventStream();
    const guarded = guardAssistantMessageStream(
      MODEL,
      () => stream,
      undefined,
      { idleTimeoutMs: DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS },
    );
    const empty = emptyAssistant();
    const doneMessage: AssistantMessage = {
      ...empty,
      content: [{
        type: "toolCall",
        id: "truth-1",
        name: "write_truth_file",
        arguments: { fileName: "outline/story_frame.md", content: "# 骨架\n" },
      }],
      stopReason: "toolUse",
    };
    const events: Array<{ type?: string; error?: { errorMessage?: string } }> = [];
    const pending = (async () => {
      for await (const event of guarded) events.push(event);
    })();
    stream.push({ type: "start", partial: empty });

    try {
      await vi.advanceTimersByTimeAsync(90_000);
      expect(events.some((event) => event.type === "error")).toBe(false);
      stream.push({
        type: "toolcall_delta",
        contentIndex: 0,
        delta: "{\"fileName\":\"outline/story_frame.md\"",
        partial: empty,
      } as never);
      stream.push({ type: "done", reason: "toolUse", message: doneMessage });
      stream.end(doneMessage);
      await pending;
      expect(events.some((event) => event.type === "error")).toBe(false);
      expect(events.some((event) => event.type === "done")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports an incomplete tool when a write_truth_file stream goes idle mid-argument", async () => {
    vi.useFakeTimers();
    const stream = createAssistantMessageEventStream();
    const guarded = guardAssistantMessageStream(
      MODEL,
      () => stream,
      undefined,
      { idleTimeoutMs: DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS },
    );
    const empty = emptyAssistant();
    const events: Array<{ type?: string; error?: { errorMessage?: string } }> = [];
    const pending = (async () => {
      for await (const event of guarded) events.push(event);
    })();
    stream.push({ type: "start", partial: empty });
    stream.push({
      type: "toolcall_delta",
      contentIndex: 0,
      delta: "{\"fileName\":\"outline/story_frame.md\",\"content\":\"# ",
      partial: empty,
    } as never);

    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(events.some((event) => event.type === "error")).toBe(false);
      await vi.advanceTimersByTimeAsync(DEFAULT_PIPELINE_STREAM_IDLE_TIMEOUT_MS - 1);
      expect(events.some((event) => event.type === "error")).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      const errorEvent = events.find((event) => event.type === "error");
      expect(errorEvent?.error?.errorMessage).toContain("模型「slow-model」");
      expect(errorEvent?.error?.errorMessage).toContain("180 秒");
      expect(errorEvent?.error?.errorMessage).toContain("没有新的有效内容");
      expect(errorEvent?.error?.errorMessage).toContain("当前工具调用没有完成");
      expect(errorEvent?.error?.errorMessage).toContain("设定文件尚未写入");
      expect(errorEvent?.error?.errorMessage).toContain("请重试");
      expect(errorEvent?.error?.errorMessage).not.toContain("60 秒");
      expect(errorEvent?.error?.errorMessage).not.toMatch(/produced no token/i);
      expect(errorEvent?.error?.errorMessage).not.toMatch(/did not finish/i);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("formatLlmStreamTimeoutMessage", () => {
  it("keeps Chinese idle copy accurate and mentions an unfinished tool when asked", () => {
    const idle = new LLMStreamInactivityError("idle", 180_000);
    expect(formatLlmStreamTimeoutMessage(idle, {
      model: "kimi-k2-thinking",
      service: "openai",
    })).toBe(
      "模型「kimi-k2-thinking」（服务：openai）已超过 180 秒没有新的有效内容（思考/正文/工具调用）。请检查该服务的超时或流式兼容性，或换一个响应更快的模型。",
    );
    expect(formatLlmStreamTimeoutMessage(idle, {
      model: "kimi-k2-thinking",
      service: "openai",
      incompleteTool: true,
    })).toContain("当前工具调用没有完成，设定文件尚未写入。请重试。");
  });
});
