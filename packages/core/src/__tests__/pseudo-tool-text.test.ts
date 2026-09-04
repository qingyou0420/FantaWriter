import { describe, expect, it } from "vitest";
import {
  detectPseudoToolText,
  formatPseudoToolFailureMessage,
  formatPseudoToolRepairPrompt,
} from "../agent/pseudo-tool-text.js";

describe("detectPseudoToolText", () => {
  it("detects the kimi story_frame prose marker from the session log", () => {
    expect(detectPseudoToolText("（tool_write_truth_file: outline/story_frame.md）")).toEqual({
      toolName: "write_truth_file",
      raw: "（tool_write_truth_file: outline/story_frame.md）",
    });
  });

  it("detects the earlier fake read marker", () => {
    expect(detectPseudoToolText("（tool_read=\"story/outline/story_frame.md\"）")).toEqual({
      toolName: "read",
      raw: "（tool_read=\"story/outline/story_frame.md\"）",
    });
  });

  it("ignores ordinary discussion and real chapter-like prose", () => {
    expect(detectPseudoToolText("ok")).toBeUndefined();
    expect(detectPseudoToolText("可以用 write_truth_file 改骨架，要不要我来？")).toBeUndefined();
    expect(detectPseudoToolText("# 第2章\n\n我把账页摊在桌上。")).toBeUndefined();
  });

  it("writes Chinese copy that names the unfinished tool and missing write", () => {
    const marker = detectPseudoToolText("（tool_write_truth_file: outline/story_frame.md）")!;
    expect(formatPseudoToolFailureMessage(marker, "zh")).toContain("没有发起真正的 write_truth_file 工具调用");
    expect(formatPseudoToolFailureMessage(marker, "zh")).toContain("设定文件尚未写入");
    expect(formatPseudoToolFailureMessage(marker, "zh")).toContain("请重试");
    expect(formatPseudoToolRepairPrompt(marker, "zh")).toContain("这不是工具调用");
    expect(formatPseudoToolRepairPrompt(marker, "zh")).toContain("原生工具调用 write_truth_file");
  });
});
