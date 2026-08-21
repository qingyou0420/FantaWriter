import { describe, expect, it } from "vitest";
import { CRAFT_SYSTEM } from "./craft";
import { GENERAL_CHAPTER_SYSTEM } from "./general";
import {
  assemble,
  AssembleError,
  bannedHits,
  GENERAL_BANNED_SUBSTRINGS,
} from "./registry";
import { buildChapterSystemPrompt, buildOutlineSystemPrompt } from "../prompts";
import { createEmptyProject } from "../types";

describe("built-in systems", () => {
  it("chapter/outline system prompts stay on the conventional craft stack", () => {
    expect(buildChapterSystemPrompt()).toBe(CRAFT_SYSTEM);
    expect(buildOutlineSystemPrompt()).toBe(CRAFT_SYSTEM);
  });
});

describe("assemble isolation", () => {
  const general = createEmptyProject("常");
  const chapter = {
    id: "c1",
    order: 1,
    title: "一",
    summary: "摘要",
    keyPoints: "点",
    intensityNote: "",
    tags: [] as string[],
  };
  const outline = {
    premise: "前提",
    endingNote: "结局",
    chapters: [chapter],
  };

  it("chapter/outline/setting/learn_style have no banned substrings", () => {
    const tasks = [
      "outline",
      "chapter",
      "expand_character",
      "optimize_character",
      "expand_background",
      "optimize_background",
      "expand_cast",
      "rewrite",
      "learn_style",
      "extract_canon",
      "continue",
      "scene_plan",
      "scene_chapter",
      "volume_summary",
    ] as const;
    for (const task of tasks) {
      const { system, user } = assemble(task, "general", {
        characters: general.characters,
        background: general.background,
        settings: general.settings,
        outline,
        chapter,
        projectTags: [],
        rewriteMode: "polish",
        selectedText: "一段正文",
        seed: "灵感",
        sampleText: "范文".repeat(40),
        titleHint: "旧稿",
        character: general.characters[0],
        existingText: "前文。",
        scene: { order: 1, title: "码头", summary: "靠岸" },
        volume: { id: "v1", order: 1, title: "上卷", summary: "离乡" },
        chapterSummaries: [{ order: 1, title: "一", summary: "上路" }],
      });
      const hits = bannedHits(system + "\n" + user);
      expect(hits, `${task} leaked ${hits.join(",")}`).toEqual([]);
    }
    expect(GENERAL_BANNED_SUBSTRINGS.length).toBeGreaterThan(5);
    const { system } = assemble("chapter", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      outline,
      chapter,
      projectTags: [],
    });
    expect(system).toContain(GENERAL_CHAPTER_SYSTEM.slice(0, 20));
  });

  it("rejects scale-rewrite modes that are not part of this edition", () => {
    expect(() =>
      assemble("rewrite", "general", {
        rewriteMode: "more_erotic",
        selectedText: "x",
        characters: general.characters,
        background: general.background,
        settings: general.settings,
      })
    ).toThrow(AssembleError);
  });

  it("always assembles as conventional even if a stale board is sent", () => {
    const { user } = assemble("chapter", "literary" as never, {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      outline,
      chapter,
      projectTags: ["悬疑"],
    });
    expect(user).toContain("类型标签");
    expect(user).not.toContain("色情尺度");
  });

  it("appends extraRules at the end of system; empty restores built-in", () => {
    const payload = {
      characters: general.characters,
      background: general.background,
      settings: { ...general.settings, extraRules: "" },
      outline,
      chapter,
      projectTags: [],
    };
    const base = assemble("chapter", "general", payload);
    const withRules = assemble("chapter", "general", {
      ...payload,
      settings: {
        ...general.settings,
        extraRules: "保持冷色调\n禁止现代网络梗",
      },
    });
    expect(withRules.system.startsWith(base.system)).toBe(true);
    expect(withRules.system.endsWith("- 禁止现代网络梗")).toBe(true);
    expect(withRules.system).toContain("## 用户附加规则");
    expect(withRules.system).toContain("保持冷色调");
    const cleared = assemble("chapter", "general", {
      ...payload,
      settings: { ...general.settings, extraRules: "  \n  " },
    });
    expect(cleared.system).toBe(base.system);
  });

  it("chapter prompt states a hard length band and forbids early wrap-up", () => {
    const { user } = assemble("chapter", "general", {
      characters: general.characters,
      background: general.background,
      settings: { ...general.settings, length: "long" },
      outline,
      chapter,
      projectTags: [],
    });
    expect(user).toContain("3000–5000");
    expect(user).toContain("硬性");
    expect(user).toMatch(/禁止.*收束|禁止提前/);
  });

  it("injects priorBlock once, before the current chapter heading", () => {
    const marker = "只出现一次的记忆包标记XYZ";
    const { user } = assemble("chapter", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      outline,
      chapter,
      projectTags: [],
      priorBlock: `## 角色状态卡\n${marker}`,
    });
    expect(user.split(marker).length - 1).toBe(1);
    expect(user.indexOf(marker)).toBeLessThan(user.indexOf("## 当前要写的章节"));
    expect(user).toContain("## 正文要求");
  });

  it("learned style copies guide and ≥3 fingerprints into system", () => {
    const prints = [
      "雨停了，檐水还在。",
      "他没有回头。",
      "灯灭了一盏。",
      "门缝里有风。",
    ];
    const { system, user } = assemble("chapter", "general", {
      characters: general.characters,
      background: general.background,
      settings: {
        ...general.settings,
        writingStyle: "learned",
        learnedStyleName: "冷硬短句",
        learnedStyleGuide: "冷硬短句，少形容词，对话短促。",
        learnedStyleFingerprints: prints,
      },
      outline,
      chapter,
      projectTags: [],
    });
    expect(system).toContain("冷硬短句，少形容词");
    expect(system).toContain("风格例句（模仿其气质，勿照抄）");
    for (const line of prints.slice(0, 3)) {
      expect(system).toContain(line);
    }
    expect(user).toContain("风格例句（模仿其气质，勿照抄）");
  });

  it("selected cast gets full cards; others stay on one line", () => {
    const cast = [
      {
        ...general.characters[0],
        id: "a",
        name: "甲",
        role: "主角",
        appearance: "甲的外貌很长一段描写",
        personality: "甲的性格",
      },
      {
        ...general.characters[0],
        id: "b",
        name: "乙",
        role: "配角",
        appearance: "乙的外貌",
        personality: "乙的性格",
      },
      {
        ...general.characters[0],
        id: "c",
        name: "丙",
        role: "对手",
        appearance: "丙的外貌",
        personality: "丙的性格",
      },
    ];
    const extra = {
      ...general.characters[0],
      id: "d",
      name: "丁",
      role: "路人",
      appearance: "丁不该出现完整外貌设定",
      personality: "丁不该出现完整性格设定",
      background: "丁的冗长背景不应整段注入",
      relationships: "与甲有旧怨",
    };
    const { user } = assemble("chapter", "general", {
      characters: [...cast, extra],
      background: general.background,
      settings: general.settings,
      outline,
      chapter: { ...chapter, castIds: ["a", "b", "c"] },
      projectTags: [],
    });
    expect(user).toContain("本章出场人物");
    expect(user).toContain("甲的外貌很长一段描写");
    expect(user).toContain("其余人物（仅名片，非必要勿写入正文）");
    const cardLine = user
      .split("\n")
      .find((line) => line.startsWith("- 丁"));
    expect(cardLine).toBeTruthy();
    expect(cardLine).not.toContain("\n");
    expect(user).not.toContain("丁不该出现完整外貌设定");
    expect(user).not.toContain("丁的冗长背景不应整段注入");
  });

  it("rewrite user includes prior memory and the sliding window as-is", () => {
    const window = `前文滑窗标记ABC${"字".repeat(80)}待改段后文滑窗标记DEF`;
    const { user } = assemble("rewrite", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      rewriteMode: "expand",
      mode: "expand",
      selectedText: "待改的一段",
      fullContext: window,
      priorBlock: "## 前情摘要（前几章）\n第1章：渡口定约",
      expandScale: 2,
      expandTargetChars: 400,
    });
    expect(user).toContain("渡口定约");
    expect(user).toContain("前文滑窗标记ABC");
    expect(user).toContain("待改段后文滑窗标记DEF");
    expect(user).toContain("至少写到约 400 字");
  });

  it("volume outline user asks for this volume only", () => {
    const { user } = assemble("outline_volume", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      volume: { id: "v2", order: 2, title: "中卷", summary: "朝堂裂开" },
      previousEnding: "上卷终章：渡口定约已破。",
      chapterCount: 12,
      projectTags: [],
    });
    expect(user).toContain("中卷");
    expect(user).toContain("朝堂裂开");
    expect(user).toContain("渡口定约已破");
    expect(user).toContain("12");
    expect(user).toContain("不要规划其它卷");
  });

  it("route.ts no longer regex-injects prior before 正文要求", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/api/generate/route.ts", "utf8");
    expect(src).not.toMatch(/user\.replace\(\s*\/## 正文要求/);
    expect(src).toMatch(/chapterTemperature\(body\.settings\)/);
    expect(src).toMatch(/resolveChapterTemperature/);
    expect(src).toContain('mode: "volume_summary"');
  });

  it("continue injects priorBlock once, same as chapter", () => {
    const marker = "只出现一次的续写记忆包XYZ";
    const { user } = assemble("continue", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      existingText: "前文。",
      chapter,
      priorBlock: `## 角色状态卡\n${marker}`,
    });
    expect(user.split(marker).length - 1).toBe(1);
    expect(user).toContain("只输出续写部分");
  });

  it("dead prompt exports stay gone", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/prompts.ts", "utf8");
    expect(src).not.toMatch(/ADULT_SYSTEM/);
    expect(src).not.toMatch(/buildContinueUserPrompt/);
    expect(src).not.toMatch(/欲望走向|暧昧、禁忌、甜虐/);
    const general = readFileSync("src/lib/prompts/general.ts", "utf8");
    expect(general).toMatch(/export function generalContinueUser/);
  });

  it("continue user reads previousSummaries as 前情摘要", () => {
    const cont = assemble("continue", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      existingText: "前文。",
      chapter,
      previousSummaries: "第1章：渡口定约已破。",
    });
    expect(cont.user).toContain("前情摘要");
    expect(cont.user).toContain("渡口定约已破");
  });

  it("continue and scene_chapter user include lore when provided", () => {
    const lore = "- 【地点·灰港】雾中港口";
    const cont = assemble("continue", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      existingText: "前文。",
      chapter,
      lore,
    });
    expect(cont.user).toContain("世界观设定（关键词命中）");
    expect(cont.user).toContain("灰港");

    const scene = assemble("scene_chapter", "general", {
      characters: general.characters,
      background: general.background,
      settings: general.settings,
      chapter,
      scene: { order: 1, title: "码头", summary: "靠岸" },
      lore,
    });
    expect(scene.user).toContain("灰港");
  });
});
