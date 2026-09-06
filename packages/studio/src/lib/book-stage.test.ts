import { describe, expect, it } from "vitest";
import {
  deriveBookStage,
  migrateWorkflowFromFacts,
  parseBookWorkflow,
  storyFrameHasFourSections,
  type BookStageFacts,
} from "./book-stage";

function facts(overrides: Partial<BookStageFacts> = {}): BookStageFacts {
  return {
    bookExists: true,
    authorIntentNonEmpty: false,
    storyCardExists: false,
    storyFrameNonEmpty: false,
    storyFrameFourSectionsNonEmpty: false,
    majorRoleCount: 0,
    weaveLocked: false,
    nextChapterHasOutline: false,
    chaptersWritten: 0,
    ...overrides,
  };
}

describe("storyFrameHasFourSections", () => {
  it("accepts four named Chinese sections", () => {
    const markdown = [
      "## 世界铁律",
      "不可飞升。",
      "## 人物底色",
      "苏绻冷而直。",
      "## 核心冲突",
      "德与兵。",
      "## 终局",
      "书院重开。",
    ].join("\n");
    expect(storyFrameHasFourSections(markdown)).toBe(true);
  });

  it("rejects a single paragraph", () => {
    expect(storyFrameHasFourSections("# 骨架\n\n一段话。")).toBe(false);
  });
});

describe("deriveBookStage", () => {
  it("starts a bare book at 问心", () => {
    const snap = deriveBookStage(facts());
    expect(snap.stage).toBe("ask");
    expect(snap.steps.ask).toBe("current");
    expect(snap.steps.ground).toBe("todo");
  });

  it("does not rewind an old book that already has a story frame", () => {
    const snap = deriveBookStage(facts({
      storyFrameNonEmpty: true,
      authorIntentNonEmpty: true,
      groundConfirmedAt: "2026-09-01T00:00:00.000Z",
      majorRoleCount: 2,
    }));
    expect(snap.stage).toBe("weave");
    expect(snap.steps.ask).toBe("done");
    expect(snap.steps.ground).toBe("done");
    expect(snap.steps.weave).toBe("current");
  });

  it("lands a locked outline with a next-chapter card on 落笔", () => {
    const snap = deriveBookStage(facts({
      storyFrameNonEmpty: true,
      groundConfirmedAt: "2026-09-01T00:00:00.000Z",
      majorRoleCount: 1,
      weaveLocked: true,
      nextChapterHasOutline: true,
    }));
    expect(snap.stage).toBe("write");
    expect(snap.steps.weave).toBe("done");
    expect(snap.steps.write).toBe("current");
  });

  it("never forces 问心 when chapters already exist", () => {
    const snap = deriveBookStage(facts({
      chaptersWritten: 3,
      storyFrameNonEmpty: false,
      storyCardExists: false,
    }));
    expect(snap.stage).toBe("write");
    expect(snap.steps.ask).toBe("done");
  });
});

describe("migrateWorkflowFromFacts", () => {
  it("writes confirm timestamps for an existing story_frame book", () => {
    const { workflow, wrote } = migrateWorkflowFromFacts(null, facts({
      authorIntentNonEmpty: true,
      storyFrameNonEmpty: true,
      majorRoleCount: 1,
      weaveLocked: true,
      nextChapterHasOutline: true,
    }), "2026-09-06T00:00:00.000Z");
    expect(wrote).toBe(true);
    expect(workflow.groundConfirmedAt).toBe("2026-09-06T00:00:00.000Z");
    expect(workflow.askConfirmedAt).toBe("2026-09-06T00:00:00.000Z");
    expect(workflow.weaveLockedAt).toBe("2026-09-06T00:00:00.000Z");
    expect(workflow.lastStage).toBe("write");
  });

  it("keeps an existing workflow and only refreshes lastStage", () => {
    const existing = parseBookWorkflow({
      askConfirmedAt: "2026-01-01T00:00:00.000Z",
      groundConfirmedAt: "2026-01-02T00:00:00.000Z",
      lastStage: "ground",
    });
    const { workflow, wrote } = migrateWorkflowFromFacts(existing, facts({
      storyFrameNonEmpty: true,
      majorRoleCount: 1,
      weaveLocked: true,
      nextChapterHasOutline: true,
    }), "2026-09-06T00:00:00.000Z");
    expect(wrote).toBe(true);
    expect(workflow.askConfirmedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(workflow.lastStage).toBe("write");
  });
});
