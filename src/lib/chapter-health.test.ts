import { describe, expect, it } from "vitest";
import { buildChapterHealth } from "./chapter-health";

describe("buildChapterHealth", () => {
  it("aggregates outline, length, canon, and summary in one report", () => {
    const health = buildChapterHealth({
      outlineCheck: {
        covered: ["上路"],
        missing: ["定约"],
        extra: [],
        score: 6,
        advice: "补上定约",
      },
      content: "甲走了。",
      settings: { length: "medium", customLength: { min: 20, max: 40 } },
      canon: [
        {
          id: "1",
          name: "甲",
          kind: "character",
          statement: "甲是左撇子",
          locked: true,
        },
      ],
      summary: "甲离开渡口。",
    });
    expect(health.outline?.score).toBe(6);
    expect(health.outline?.missing).toContain("定约");
    expect(health.length.min).toBe(20);
    expect(health.length.ok).toBe(false);
    expect(health.summary.present).toBe(true);
    expect(health.canon.ok).toBe(true);
  });
});
