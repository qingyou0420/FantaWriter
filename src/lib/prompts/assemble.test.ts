import { describe, expect, it } from "vitest";
import { ADULT_SYSTEM } from "./erotic-systems";
import {
  assemble,
  AssembleError,
  bannedHits,
  GENERAL_BANNED_SUBSTRINGS,
} from "./registry";
import { buildChapterSystemPrompt, buildOutlineSystemPrompt } from "../prompts";
import { createEmptyProject } from "../types";

describe("PR4 byte-identical adult systems", () => {
  it("buildChapterSystemPrompt matches 1.8.1 ADULT_SYSTEM exactly", () => {
    expect(buildChapterSystemPrompt()).toBe(ADULT_SYSTEM);
  });

  it("buildOutlineSystemPrompt is the same ADULT_SYSTEM", () => {
    expect(buildOutlineSystemPrompt()).toBe(ADULT_SYSTEM);
  });
});

describe("assemble isolation", () => {
  const erotic = createEmptyProject("色", "erotic");
  const general = createEmptyProject("常", "general");
  const chapter = {
    id: "c1",
    order: 1,
    title: "一",
    summary: "摘要",
    keyPoints: "点",
    eroticNote: "无",
    tags: [] as string[],
  };
  const outline = {
    premise: "前提",
    endingNote: "结局",
    chapters: [chapter],
  };

  it("general chapter/outline/setting/learn_style have no banned substrings", () => {
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
        character: general.characters[0],
      });
      const hits = bannedHits(system + "\n" + user);
      expect(hits, `${task} leaked ${hits.join(",")}`).toEqual([]);
    }
    expect(GENERAL_BANNED_SUBSTRINGS.length).toBeGreaterThan(5);
  });

  it("erotic chapter system is ADULT_SYSTEM and user has 色情尺度", () => {
    const { system, user } = assemble("chapter", "erotic", {
      characters: erotic.characters,
      background: erotic.background,
      settings: { ...erotic.settings, eroticLevel: 5 },
      outline,
      chapter: { ...chapter, tags: ["口交"] },
      projectTags: ["口交"],
    });
    expect(system).toBe(ADULT_SYSTEM);
    expect(user).toContain("色情尺度：5/5");
    expect(user).toContain("全书强制标签");
    expect(system).toContain("18+");
  });

  it("rejects more_erotic on general", () => {
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

  it("rejects invalid writingBoard", () => {
    expect(() =>
      assemble("outline", "literary" as never, {
        characters: [],
        background: general.background,
        settings: general.settings,
      })
    ).toThrow(/WRITING_BOARD_REQUIRED/);
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

    const scene = assemble("scene_chapter", "erotic", {
      characters: erotic.characters,
      background: erotic.background,
      settings: erotic.settings,
      chapter,
      scene: { order: 1, title: "码头", summary: "靠岸" },
      lore,
    });
    expect(scene.user).toContain("灰港");
  });
});
