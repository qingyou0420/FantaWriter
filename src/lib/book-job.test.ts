import { describe, expect, it } from "vitest";
import { normalizeStaleJob, type BookJob } from "./book-job";

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
