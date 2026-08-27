import { describe, expect, it } from "vitest";
import {
  parseCharacterStatesAppendix,
  stripCharacterStatesAppendix,
} from "./character-states";
import {
  buildChapterSummaryUserPrompt,
  buildConsistencyCheckUserPrompt,
  parseConsistencyResult,
  parseOutlineJson,
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

  it("asks for a states JSON appendix and tolerates parse failure", () => {
    const prompt = buildChapterSummaryUserPrompt({
      title: "一",
      content: "甲左臂骨折。",
    });
    expect(prompt).toContain('"states"');
    expect(prompt).toContain("name");
    expect(prompt).toContain("injury");

    const mixed = `甲在渡口定约。
触及的伏笔：渡口定约
{"states":[{"name":"甲","injury":"左臂骨折","location":"渡口"}]}`;
    expect(parseCharacterStatesAppendix(mixed)).toEqual([
      { name: "甲", injury: "左臂骨折", location: "渡口" },
    ]);
    expect(stripCharacterStatesAppendix(mixed)).toContain("甲在渡口定约");
    expect(stripCharacterStatesAppendix(mixed)).not.toContain("左臂骨折");
    expect(parseCharacterStatesAppendix("只有散文，没有 JSON")).toEqual([]);
    expect(parseCharacterStatesAppendix("{ not json")).toEqual([]);
  });

  it("maps outline cast names to character ids and keeps hook", () => {
    const a = { ...createEmptyCharacter(), id: "id-a", name: "甲" };
    const b = { ...createEmptyCharacter(), id: "id-b", name: "乙" };
    const outline = parseOutlineJson(
      JSON.stringify({
        premise: "p",
        endingNote: "e",
        chapters: [
          {
            order: 1,
            title: "一",
            summary: "上路",
            keyPoints: "走",
            hook: "门后有人",
            cast: ["甲", "路人丙"],
          },
        ],
      }),
      { characters: [a, b] }
    );
    expect(outline.chapters[0].castIds).toEqual(["id-a"]);
    expect(outline.chapters[0].hook).toBe("门后有人");

    const old = parseOutlineJson(
      JSON.stringify({
        premise: "p",
        endingNote: "e",
        chapters: [{ order: 1, title: "一", summary: "s", keyPoints: "k" }],
      })
    );
    expect(old.chapters[0].castIds).toEqual([]);
    expect(old.chapters[0].hook).toBe("");
  });
});
