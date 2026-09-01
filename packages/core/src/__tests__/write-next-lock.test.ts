import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PipelineRunner } from "../pipeline/runner.js";
import { StateManager } from "../state/manager.js";
import * as chapterPersistence from "../pipeline/chapter-persistence.js";

describe("writeNextChapter lock ownership", () => {
  const temps: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  function runner(root: string): PipelineRunner {
    return new PipelineRunner({
      client: { complete: async () => { throw new Error("llm unused"); } } as never,
      model: "test",
      projectRoot: root,
    });
  }

  it("acquires the book lock with a named abortable write-next holder", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-wn-"));
    temps.push(root);
    const acquire = vi.spyOn(StateManager.prototype, "acquireBookLock");
    const controller = new AbortController();
    const pipe = runner(root);
    await pipe
      .runWithAgentContext(
        {
          abort: controller,
          signal: controller.signal,
          lockTaskId: "write-next-demo",
        },
        () => pipe.writeNextChapter("demo"),
      )
      .catch(() => undefined);

    expect(acquire).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        taskId: "write-next-demo",
        stage: "write-next",
        abort: controller,
      }),
    );
  });

  it("does not persist a chapter after force-release aborts the write-next holder", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-wn-"));
    temps.push(root);
    const persist = vi.spyOn(chapterPersistence, "persistChapterArtifacts");
    const controller = new AbortController();
    const pipe = runner(root);

    await expect(
      pipe.runWithAgentContext(
        {
          abort: controller,
          signal: controller.signal,
          lockTaskId: "write-next-hung",
          onLocked: () => {
            void new StateManager(root).forceReleaseBookLock("demo", { graceMs: 0 });
          },
        },
        () => pipe.writeNextChapter("demo"),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(persist).not.toHaveBeenCalled();
    expect(controller.signal.aborted).toBe(true);
    expect(new StateManager(root).inspectBookLock("demo")).toBeNull();
  });

  it("names the write-next holder on BOOK_BUSY when a second write collides", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-wn-"));
    temps.push(root);
    const held = await new StateManager(root).acquireBookLock("demo", {
      taskId: "write-next-first",
      stage: "write-next",
    });
    try {
      await expect(runner(root).writeNextChapter("demo")).rejects.toMatchObject({
        code: "BOOK_BUSY",
        owner: expect.objectContaining({
          taskId: "write-next-first",
          stage: "write-next",
        }),
      });
    } finally {
      await held();
    }
  });
});
