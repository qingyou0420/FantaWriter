import { describe, expect, it } from "vitest";
import {
  authorIntentFromStoryCard,
  createBookInstruction,
  extractStoryCardDraft,
  parseStoryCard,
  serializeStoryCard,
  storyCardReady,
  trimStoryCard,
} from "./story-card";

describe("story card", () => {
  it("is ready only when the three fields are present", () => {
    expect(storyCardReady({ workingTitle: "醉词", oneLine: "", synopsis: "梗概" })).toBe(false);
    expect(storyCardReady({ workingTitle: "醉词", oneLine: "一句话", synopsis: "初步梗概" })).toBe(true);
  });

  it("round-trips frontmatter and caps synopsis at 300", () => {
    const card = trimStoryCard({
      workingTitle: "醉词",
      oneLine: "书院群像",
      synopsis: "甲".repeat(340),
      genre: "古风群像",
      tone: "冷冽",
    });
    expect(card.synopsis).toHaveLength(300);
    const parsed = parseStoryCard(serializeStoryCard(card));
    expect(parsed.workingTitle).toBe("醉词");
    expect(parsed.oneLine).toBe("书院群像");
    expect(parsed.genre).toBe("古风群像");
    expect(parsed.tone).toBe("冷冽");
    expect(parsed.synopsis).toHaveLength(300);
  });

  it("extracts a draft from chat + proposed create_book", () => {
    const draft = extractStoryCardDraft({
      messages: [
        { role: "user", content: "想写一本书院群像，主角苏绻入辩堂。" },
        { role: "assistant", content: "书名：醉词\n一句话：四人在琴荒书院相识\n梗概：春日入堂，身份暗流。" },
      ],
      proposed: { title: "醉词", genre: "古风", oneLine: "琴荒书院" },
    });
    expect(draft.workingTitle).toBe("醉词");
    expect(draft.oneLine).toBe("琴荒书院");
    expect(draft.synopsis).toContain("春日入堂");
    expect(draft.genre).toBe("古风");
  });

  it("builds create_book instruction and author_intent from the card", () => {
    const card = { workingTitle: "醉词", oneLine: "一句话", synopsis: "梗概" };
    expect(createBookInstruction(card, true)).toMatch(/就此建书/);
    expect(authorIntentFromStoryCard(card, "zh")).toMatch(/暂定书名：醉词/);
  });
});
