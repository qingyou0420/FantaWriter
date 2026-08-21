import { describe, expect, it } from "vitest";
import { applyGlobalReplace } from "./find-replace";
import { buildMemoryPack } from "./memory-pack";
import { createEmptyProject } from "./types";

describe("global replace scopes", () => {
  it("replacing summaries and outline drops the old name from memory pack", () => {
    const p = createEmptyProject("改名");
    p.outline = {
      premise: "旧名出场",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "旧名渡口",
          summary: "旧名离开渡口",
          keyPoints: "旧名受伤",
          tags: [],
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "接上",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "旧名渡口",
        content: "正文里的旧名走了。",
        status: "done",
        updatedAt: "",
        summary: "章摘要：旧名在渡口定约。",
      },
    ];
    const before = buildMemoryPack(p, 2);
    expect(before.previousSummaries).toContain("旧名");

    const applied = applyGlobalReplace(p, "旧名", "新名", {
      replaceSummaries: true,
      replaceOutline: true,
    });
    const next = {
      ...p,
      chapters: applied.chapters,
      outline: applied.outline,
    };
    const pack = buildMemoryPack(next, 2);
    expect(pack.previousSummaries).not.toContain("旧名");
    expect(pack.previousSummaries).toContain("新名");
    expect(applied.outline?.chapters[0].title).toBe("新名渡口");
  });
});
