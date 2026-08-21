import { describe, expect, it, vi } from "vitest";
import { awaitChapterSummary } from "./chapter-summary";
import { buildPreviousContext } from "./api";
import { createEmptyProject } from "./types";

describe("awaitChapterSummary", () => {
  it("waits for the summary so the next chapter pack can use it", async () => {
    const p = createEmptyProject("队列");
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "大纲摘要不该进记忆",
          keyPoints: "",
          tags: [],
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "二",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "正文一",
        status: "done",
        updatedAt: "",
        summary: "",
      },
    ];

    let applied = false;
    const pending = new Promise<void>((resolve) => {
      setTimeout(() => {
        p.chapters[0] = {
          ...p.chapters[0],
          summary: "第1章真实AI摘要：渡口定约已破。",
        };
        applied = true;
        resolve();
      }, 20);
    });

    const status = await awaitChapterSummary(pending, 1000);
    expect(status).toBe("ok");
    expect(applied).toBe(true);
    const ctx = buildPreviousContext(p, 2);
    expect(ctx.previousSummaries).toContain("第1章真实AI摘要");
    expect(ctx.previousSummaries).not.toContain("大纲摘要不该进记忆");
  });

  it("times out without throwing so the queue can continue", async () => {
    vi.useFakeTimers();
    const hanging = new Promise(() => {
      /* never */
    });
    const raced = awaitChapterSummary(hanging, 50);
    await vi.advanceTimersByTimeAsync(60);
    await expect(raced).resolves.toBe("timeout");
    vi.useRealTimers();
  });

  it("treats summary rejection as error, not a queue stop", async () => {
    const status = await awaitChapterSummary(
      Promise.reject(new Error("摘要挂了")),
      200
    );
    expect(status).toBe("error");
  });
});
