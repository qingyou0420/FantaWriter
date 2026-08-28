import { describe, expect, it } from "vitest";
import {
  buildCanonicalPacket,
  chapterPromptContext,
  previewCanonicalPacket,
} from "./canonical-packet";
import { createEmptyProject } from "./types";

describe("canonical packet", () => {
  it("is bounded: does not dump the whole book", () => {
    const p = createEmptyProject("包");
    p.premiseCard = {
      premise: "回家",
      theme: "仅作者",
      endingDirection: "仅作者",
      forbidList: ["穿越"],
    };
    p.currentFocus = {
      stageGoal: "过桥",
      mustKeep: ["左肩伤"],
      mustAvoid: ["无故痊愈"],
      source: "author",
    };
    p.outline = {
      premise: "回家",
      endingNote: "",
      chapters: Array.from({ length: 20 }, (_, i) => ({
        id: `c${i + 1}`,
        order: i + 1,
        title: `第${i + 1}章`,
        summary: `要点${i + 1}`,
        keyPoints: "",
        tags: [],
        volumeId: p.volumes![0].id,
      })),
    };
    p.chapters = p.outline.chapters.map((c) => ({
      chapterId: c.id,
      title: c.title,
      content: iContent(c.order),
      status: "done" as const,
      updatedAt: "",
      summary: `摘要${c.order}`,
    }));
    const packet = buildCanonicalPacket(p, 10);
    expect(packet.priorBlock).toContain("回家");
    expect(packet.priorBlock).toContain("过桥");
    expect(packet.outlineWindow).toContain("第10章");
    expect(packet.outlineWindow).toContain("第8章");
    expect(packet.outlineWindow).not.toContain("第1章《第1章》");
    expect(packet.summaries.split("\n").length).toBeLessThanOrEqual(6);
    const preview = previewCanonicalPacket(p, "c10");
    expect(preview?.priorBlock).toBe(packet.priorBlock);
    const ctx = chapterPromptContext(p, 10);
    expect(ctx.priorBlock).toBe(packet.priorBlock);
    expect(ctx.priorBlock).toContain("必须避免：无故痊愈");
    expect(preview?.priorBlock).toContain("必须避免：无故痊愈");
  });
});

function iContent(order: number) {
  return `第${order}章正文。`.repeat(20);
}
