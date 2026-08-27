import { afterEach, describe, expect, it } from "vitest";
import {
  FINE_WRITING_MODES,
  buildChatRequestBody,
  getDefaultModel,
  isFineSlotConfigured,
  resolveModelSlot,
  thinkingEnabled,
  usesFineWritingSlot,
} from "./ai";

const ENV_KEYS = [
  "DEEPSEEK_MODEL",
  "DEEPSEEK_THINKING",
  "FINE_MODEL",
  "FINE_API_KEY",
  "FINE_BASE_URL",
] as const;

const saved: Record<string, string | undefined> = {};

function setEnv(patch: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    if (!(key in saved)) saved[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const prev = saved[key];
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
});

describe("fine writing slot table", () => {
  it("routes only the four prose tasks to the fine slot", () => {
    expect([...FINE_WRITING_MODES].sort()).toEqual(
      ["chapter", "continue", "rewrite", "scene_chapter"].sort()
    );
    expect(usesFineWritingSlot("chapter")).toBe(true);
    expect(usesFineWritingSlot("chapter_summary")).toBe(false);
    expect(usesFineWritingSlot("outline")).toBe(false);
    expect(usesFineWritingSlot("consistency_check")).toBe(false);
    expect(usesFineWritingSlot("extract_canon")).toBe(false);
    expect(usesFineWritingSlot("learn_style")).toBe(false);
    expect(usesFineWritingSlot("volume_summary")).toBe(false);
  });
});

describe("chat request body env combinations", () => {
  it("main-only / thinking off: no thinking field, default model unchanged", () => {
    setEnv({
      DEEPSEEK_MODEL: "deepseek-v4-pro",
      DEEPSEEK_THINKING: undefined,
      FINE_MODEL: undefined,
    });
    expect(thinkingEnabled()).toBe(false);
    expect(isFineSlotConfigured()).toBe(false);
    expect(resolveModelSlot("chapter")).toBe("main");
    expect(getDefaultModel()).toBe("deepseek-v4-pro");

    const chapter = buildChatRequestBody("sys", "user", {
      mode: "chapter",
      temperature: 0.9,
    });
    expect(chapter.model).toBe("deepseek-v4-pro");
    expect(chapter).not.toHaveProperty("thinking");
    expect(JSON.stringify(chapter)).not.toContain("thinking");
    expect(chapter.temperature).toBe(0.9);

    const summary = buildChatRequestBody("sys", "user", {
      mode: "chapter_summary",
    });
    expect(summary.model).toBe("deepseek-v4-pro");
    expect(summary).not.toHaveProperty("thinking");
  });

  it("fine slot configured: chapter uses FINE_MODEL, chapter_summary stays on DEEPSEEK_MODEL", () => {
    setEnv({
      DEEPSEEK_MODEL: "deepseek-v4-pro",
      DEEPSEEK_THINKING: undefined,
      FINE_MODEL: "claude-opus-proxy",
    });
    expect(resolveModelSlot("chapter")).toBe("fine");
    expect(resolveModelSlot("continue")).toBe("fine");
    expect(resolveModelSlot("rewrite")).toBe("fine");
    expect(resolveModelSlot("scene_chapter")).toBe("fine");
    expect(resolveModelSlot("chapter_summary")).toBe("main");
    expect(resolveModelSlot("outline")).toBe("main");

    const chapter = buildChatRequestBody("sys", "user", { mode: "chapter" });
    expect(chapter.model).toBe("claude-opus-proxy");
    expect(chapter).not.toHaveProperty("thinking");

    const summary = buildChatRequestBody("sys", "user", {
      mode: "chapter_summary",
    });
    expect(summary.model).toBe("deepseek-v4-pro");
    expect(summary).not.toHaveProperty("thinking");
  });

  it("DEEPSEEK_THINKING=1 sends thinking:{type:enabled}", () => {
    setEnv({
      DEEPSEEK_MODEL: "deepseek-v4-pro",
      DEEPSEEK_THINKING: "1",
      FINE_MODEL: undefined,
    });
    expect(thinkingEnabled()).toBe(true);
    const body = buildChatRequestBody("sys", "user", {
      mode: "chapter_summary",
      temperature: 0.4,
    });
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.temperature).toBeUndefined();
    expect(body.model).toBe("deepseek-v4-pro");
  });
});
