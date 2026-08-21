import { describe, expect, it } from "vitest";
import {
  buildChapterSummaryUserPrompt,
  buildConsistencyCheckUserPrompt,
  parseConsistencyResult,
  parseTouchedThreads,
  stripTouchedThreadLine,
} from "./prompts";
import { createEmptyCharacter, createDefaultBackground } from "./types";

describe("consistency check template", () => {
  it("emits unique JSON keys and a character field", () => {
    const prompt = buildConsistencyCheckUserPrompt({
      characters: [
        { ...createEmptyCharacter(), name: "甲" },
      ],
      background: createDefaultBackground(),
      chapters: [{ order: 1, title: "一", summary: "甲在渡口受伤" }],
    });
    expect(prompt).toContain("优先章摘要");
    expect(prompt.match(/"severity"/g)?.length).toBe(1);
    expect(prompt.match(/"character"/g)?.length).toBe(1);
    expect(prompt).toContain("high/medium/low");
    expect(prompt).toContain('"detail"');
  });

  it("parseConsistencyResult keeps character names", () => {
    const parsed = parseConsistencyResult(`{
      "score": 6,
      "summary": "称呼漂移",
      "issues": [
        {
          "severity": "high",
          "detail": "甲被叫成乙",
          "suggestion": "统一称呼",
          "character": "甲",
          "chapter": "一"
        }
      ]
    }`);
    expect(parsed.issues[0].character).toBe("甲");
    expect(parsed.issues[0].severity).toBe("high");
  });

  it("falls back when the model put the name in severity", () => {
    const parsed = parseConsistencyResult(`{
      "score": 5,
      "summary": "残缺模板",
      "issues": [
        {
          "severity": "白马",
          "detail": "身份写错",
          "suggestion": "按锁定设定改"
        }
      ]
    }`);
    expect(parsed.issues[0].character).toBe("白马");
  });
});

describe("touched plot threads", () => {
  it("asks for 触及的伏笔 and parses the line", () => {
    const prompt = buildChapterSummaryUserPrompt({
      title: "一",
      content: "渡口定约被撕开。",
      openThreads: ["渡口定约", "白马失踪"],
    });
    expect(prompt).toContain("渡口定约");
    expect(prompt).toContain("触及的伏笔");

    expect(parseTouchedThreads("摘要。\n触及的伏笔：渡口定约、白马失踪")).toEqual([
      "渡口定约",
      "白马失踪",
    ]);
    expect(parseTouchedThreads("触及的伏笔：无")).toEqual([]);
    expect(stripTouchedThreadLine("摘要一句\n触及的伏笔：A\n结尾")).toBe(
      "摘要一句\n结尾"
    );
  });
});
