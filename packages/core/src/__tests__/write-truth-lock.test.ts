import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWriteTruthFileTool } from "../agent/agent-tools.js";
import { listTruthProposals } from "../interaction/truth-proposals.js";
import {
  BookWriteLockError,
  formatBookWriteLockCopy,
  resetProcessBookLocksForTest,
  StateManager,
} from "../state/manager.js";

describe("write_truth_file + book write lock", () => {
  const temps: string[] = [];

  afterEach(async () => {
    resetProcessBookLocksForTest();
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function seedBook(bookId: string): Promise<{ root: string; state: StateManager }> {
    const root = await mkdtemp(join(tmpdir(), "fw-truth-lock-"));
    temps.push(root);
    const state = new StateManager(root);
    const bookDir = state.bookDir(bookId);
    await mkdir(join(bookDir, "story", "outline"), { recursive: true });
    await writeFile(join(bookDir, "book.json"), JSON.stringify({
      id: bookId,
      title: bookId,
      platform: "other",
      genre: "other",
      status: "active",
      targetChapters: 10,
      chapterWordCount: 2000,
      language: "zh",
      createdAt: "2026-09-06T00:00:00.000Z",
      updatedAt: "2026-09-06T00:00:00.000Z",
    }), "utf-8");
    await writeFile(join(bookDir, "story", "outline", "volume_map.md"), "# 卷地图\n\n旧纲。\n", "utf-8");
    await writeFile(join(bookDir, "story", "current_state.md"), "# 状态\n\n码头。\n", "utf-8");
    await writeFile(join(bookDir, "story", "pending_hooks.md"), "# 钩子\n\n失败的试探。\n", "utf-8");
    return { root, state };
  }

  it("stages outline/volume_map.md while a pipeline write lock is held", async () => {
    const { root, state } = await seedBook("醉词");
    const held = await state.acquireBookLock("醉词", {
      taskId: "write-next-scheduler",
      stage: "write-next",
    });
    try {
      const tool = createWriteTruthFileTool({} as never, root, "醉词");
      const result = await tool.execute("tool-volume-map", {
        fileName: "outline/volume_map.md",
        content: "# 卷地图\n\n新的分卷。\n",
      });
      expect((result as { isError?: boolean }).isError).toBeFalsy();
      expect(result.details).toMatchObject({ kind: "proposed_truth_diff", fileName: "outline/volume_map.md" });
      await expect(readFile(join(state.bookDir("醉词"), "story", "outline", "volume_map.md"), "utf-8"))
        .resolves.toContain("旧纲");
      const proposals = await listTruthProposals(state.bookDir("醉词"), "pending");
      expect(proposals).toHaveLength(1);
    } finally {
      await held();
    }
  });

  it("waits for a short pipeline lock then writes runtime-truth", async () => {
    const { root, state } = await seedBook("醉词");
    const held = await state.acquireBookLock("醉词", {
      taskId: "write-next-brief",
      stage: "write-next",
    });
    const tool = createWriteTruthFileTool({} as never, root, "醉词");
    const pending = tool.execute("tool-state", {
      fileName: "current_state.md",
      content: "# 状态\n\n已经离开码头。\n",
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 60));
    await held();
    const result = await pending;
    expect((result as { isError?: boolean }).isError).toBeFalsy();
    await expect(readFile(join(state.bookDir("醉词"), "story", "current_state.md"), "utf-8"))
      .resolves.toContain("已经离开码头");
  });

  it("returns 写入被占用 with isError when a live pipeline lock does not release", async () => {
    const { root, state } = await seedBook("醉词");
    const held = await state.acquireBookLock("醉词", {
      taskId: "write-next-long",
      stage: "write-next",
    });
    try {
      const error = await state.acquireBookLock("醉词", { stage: "write-truth" }, { waitMs: 50, pollMs: 15 })
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(BookWriteLockError);
      const copy = formatBookWriteLockCopy(error as BookWriteLockError, "zh");
      expect(copy).toContain("写入被占用");
      expect(copy).toContain("醉词");
      expect(copy).not.toContain("读取");

      const tool = createWriteTruthFileTool({} as never, root, "醉词");
      const toolResult = await tool.execute("tool-busy", {
        fileName: "outline/volume_map.md",
        content: "# 卷地图\n\n仍应能提案。\n",
      });
      expect((toolResult as { isError?: boolean }).isError).toBeFalsy();
      expect(toolResult.details).toMatchObject({ kind: "proposed_truth_diff" });
      await expect(readFile(join(state.bookDir("醉词"), "story", "current_state.md"), "utf-8"))
        .resolves.toContain("码头");
    } finally {
      await held();
    }
  });

  it("marks runtime-truth write_truth_file as 写入被占用, not a read failure", async () => {
    const { root, state } = await seedBook("醉词");
    const held = await state.acquireBookLock("醉词", {
      taskId: "write-next-long",
      stage: "write-next",
    });
    try {
      const acquire = vi.spyOn(StateManager.prototype, "acquireBookLock").mockRejectedValueOnce(
        new BookWriteLockError(
          "醉词",
          join(state.bookDir("醉词"), ".write.lock"),
          "pid:1 stage:write-next",
          state.inspectBookLock("醉词") ?? undefined,
        ),
      );
      const tool = createWriteTruthFileTool({} as never, root, "醉词");
      const result = await tool.execute("tool-runtime-busy", {
        fileName: "current_state.md",
        content: "# 状态\n\n不该写上。\n",
      });
      acquire.mockRestore();
      expect((result as { isError?: boolean }).isError).toBe(true);
      const text = result.content[0]?.type === "text" ? result.content[0].text : "";
      expect(text).toContain("写入被占用");
      expect(text).not.toContain("读取");
      expect(result.details).toMatchObject({ kind: "book_busy", code: "BOOK_BUSY" });
      await expect(readFile(join(state.bookDir("醉词"), "story", "current_state.md"), "utf-8"))
        .resolves.not.toContain("不该写上");
    } finally {
      await held();
    }
  });

  it("lets write_truth_file run after delete/recreate clears a leftover lock", async () => {
    const { root, state } = await seedBook("醉词");
    const leftover = await state.acquireBookLock("醉词", {
      taskId: "old-book-identity",
      stage: "write-next",
    });
    await state.forceReleaseBookLock("醉词", { graceMs: 0 });
    await rm(state.bookDir("醉词"), { recursive: true, force: true });
    expect(state.inspectBookLock("醉词")).toBeNull();

    await mkdir(join(state.bookDir("醉词"), "story", "outline"), { recursive: true });
    await writeFile(join(state.bookDir("醉词"), "story", "outline", "volume_map.md"), "# 卷地图\n\n重建。\n", "utf-8");
    const tool = createWriteTruthFileTool({} as never, root, "醉词");
    const result = await tool.execute("tool-recreate", {
      fileName: "outline/volume_map.md",
      content: "# 卷地图\n\n重建后可写。\n",
    });
    expect((result as { isError?: boolean }).isError).toBeFalsy();
    expect(result.details).toMatchObject({ kind: "proposed_truth_diff" });
    await leftover();
  });
});
