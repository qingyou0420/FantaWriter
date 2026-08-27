import { describe, expect, it } from "vitest";
import {
  allowsWholeBookGenerate,
  createBookJob,
  normalizeStaleJob,
  shouldPauseAfterMaxChapters,
  type BookJob,
} from "./book-job";
import { createEmptyProject } from "./types";

describe("normalizeStaleJob", () => {
  it("turns orphaned running jobs into paused with pending items", () => {
    const job: BookJob = {
      id: "j1",
      status: "running",
      currentChapterId: "c2",
      createdAt: "t",
      updatedAt: "t",
      mode: "missing",
      items: [
        { chapterId: "c1", order: 1, title: "一", status: "done" },
        { chapterId: "c2", order: 2, title: "二", status: "running" },
        { chapterId: "c3", order: 3, title: "三", status: "pending" },
      ],
    };
    const next = normalizeStaleJob(job);
    expect(next.status).toBe("paused");
    expect(next.currentChapterId).toBeNull();
    expect(next.items.find((i) => i.chapterId === "c2")?.status).toBe("pending");
    expect(next.items.find((i) => i.chapterId === "c1")?.status).toBe("done");
  });

  it("leaves non-running jobs unchanged", () => {
    const job: BookJob = {
      id: "j2",
      status: "paused",
      currentChapterId: null,
      createdAt: "t",
      updatedAt: "t",
      mode: "missing",
      items: [{ chapterId: "c1", order: 1, title: "一", status: "pending" }],
    };
    expect(normalizeStaleJob(job)).toEqual(job);
  });
});

describe("BookGenerationJob stays for from-scratch books", () => {
  it("is disabled only when original text is present", () => {
    expect(allowsWholeBookGenerate(createEmptyProject("从零"))).toBe(true);
    const p = createEmptyProject("焕新");
    p.original = {
      title: "旧稿",
      sourceLabel: "粘贴导入",
      text: "北城门破。",
      updatedAt: "",
    };
    expect(allowsWholeBookGenerate(p)).toBe(false);
  });
});

describe("maxChapters pause", () => {
  it("pauses after N chapters while the rest stay pending", () => {
    const outline = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      order: i + 1,
      title: `第${i + 1}章`,
      summary: "",
      keyPoints: "",
      tags: [] as string[],
    }));
    const job = createBookJob(outline, [], "missing", undefined, 2);
    expect(job.maxChapters).toBe(2);
    expect(job.items.filter((i) => i.status === "pending")).toHaveLength(5);
    expect(shouldPauseAfterMaxChapters(job, 1)).toBe(false);
    expect(shouldPauseAfterMaxChapters(job, 2)).toBe(true);
    const remaining = job.items.filter((i) => i.status === "pending");
    expect(remaining).toHaveLength(5);
  });
});
