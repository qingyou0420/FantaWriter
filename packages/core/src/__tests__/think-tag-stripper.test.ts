import { describe, expect, it } from "vitest";
import { createLeadingThinkTagStripper, stripLeadingThinkBlock } from "../llm/think-tag-stripper.js";

describe("stripLeadingThinkBlock", () => {
  it("strips a complete leading <think> block and following whitespace", () => {
    expect(stripLeadingThinkBlock("<think>推理</think>\n\n正文开始。")).toBe("正文开始。");
  });

  it("strips a leading block preceded by whitespace", () => {
    expect(stripLeadingThinkBlock("\n  <think>推理</think>正文")).toBe("正文");
  });

  it("leaves mid-text <think> occurrences untouched", () => {
    const text = "正文里介绍 <think> 标签的用法。";
    expect(stripLeadingThinkBlock(text)).toBe(text);
  });

  it("leaves an unterminated leading block untouched (no data loss)", () => {
    const text = "<think>推理到一半被截断";
    expect(stripLeadingThinkBlock(text)).toBe(text);
  });

  it("returns plain text unchanged", () => {
    expect(stripLeadingThinkBlock("普通正文。")).toBe("普通正文。");
  });
});

describe("createLeadingThinkTagStripper", () => {
  function pushAll(chunks: string[]): { emitted: string[]; flushed: string } {
    const stripper = createLeadingThinkTagStripper();
    const emitted = chunks.map((chunk) => stripper.push(chunk)).filter((piece) => piece.length > 0);
    return { emitted, flushed: stripper.flush() };
  }

  it("suppresses a leading block split across chunk boundaries", () => {
    const { emitted, flushed } = pushAll(["<th", "ink>推理A", "推理B</th", "ink>\n正文", "继续"]);
    expect(emitted.join("")).toBe("正文继续");
    expect(flushed).toBe("");
  });

  it("emits buffered text once the prefix diverges from <think>", () => {
    const { emitted, flushed } = pushAll(["<th", "ree>不是 think 标签", "，正文"]);
    expect(emitted.join("")).toBe("<three>不是 think 标签，正文");
    expect(flushed).toBe("");
  });

  it("passes plain text through immediately", () => {
    const stripper = createLeadingThinkTagStripper();
    expect(stripper.push("正文第一段")).toBe("正文第一段");
    expect(stripper.push("<think>正文中间的字样不受影响")).toBe("<think>正文中间的字样不受影响");
    expect(stripper.flush()).toBe("");
  });

  it("returns an unterminated leading block via flush", () => {
    const { emitted, flushed } = pushAll(["<think>推理没有闭合"]);
    expect(emitted).toEqual([]);
    expect(flushed).toBe("<think>推理没有闭合");
  });
});
