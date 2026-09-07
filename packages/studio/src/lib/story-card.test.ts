import { describe, expect, it } from "vitest";
import {
  authorIntentFromStoryCard,
  createBookInstruction,
  deriveStoryCard,
  extractStoryCardDraft,
  parseStoryCard,
  resolveStoryCard,
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

  it("derives a card from author_intent", () => {
    const card = deriveStoryCard({
      title: "醉词",
      authorIntent: "暂定书名：醉词\n\n四人在琴荒书院相识。\n\n春日入堂，身份暗流。",
      genre: "古风",
    });
    expect(card.workingTitle).toBe("醉词");
    expect(card.oneLine).toContain("四人");
    expect(card.synopsis).toContain("春日入堂");
    expect(card.genre).toBe("古风");
  });

  it("derives synopsis from story_frame when intent is only one line", () => {
    const card = deriveStoryCard({
      title: "醉词",
      authorIntent: "书院群像",
      storyFrameBody: "---\nfoo: bar\n---\n框架正文写开局与终局。",
    });
    expect(card.oneLine).toBe("书院群像");
    expect(card.synopsis).toContain("框架正文");
  });

  it("returns an empty derived card when every source is empty", () => {
    const card = deriveStoryCard({ title: "新书" });
    expect(card.workingTitle).toBe("新书");
    expect(card.oneLine).toBe("");
    expect(card.synopsis).toBe("");
    expect(resolveStoryCard({ title: "新书" }).source).toBe("none");
  });

  it("prefers an on-disk story_card over derived fields", () => {
    const resolved = resolveStoryCard({
      title: "醉词",
      storyCardMarkdown: serializeStoryCard({
        workingTitle: "",
        oneLine: "卡上一句话",
        synopsis: "卡上梗概",
      }),
      authorIntent: "磁盘以外的一句话",
    });
    expect(resolved.source).toBe("story_card");
    expect(resolved.card.workingTitle).toBe("醉词");
    expect(resolved.card.oneLine).toBe("卡上一句话");
  });
});
