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
        titleHint: "醉词",
        character: general.characters[0],
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
