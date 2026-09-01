import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateManager } from "@actalk/inkos-core";
import { createStudioServer } from "./server.js";

const projectConfig = {
  name: "test",
  language: "zh",
  llm: {
    provider: "custom",
    service: "custom",
    configSource: "studio",
    baseUrl: "https://example.invalid",
    model: "test-model",
    apiFormat: "chat",
    stream: true,
  },
} as never;

describe("P0 lock + truth PUT", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "fw-lock-"));
    await mkdir(join(root, "books", "demo-book", "story"), { recursive: true });
    await writeFile(
      join(root, "inkos.json"),
      JSON.stringify({ name: "test", language: "zh" }, null, 2),
      "utf-8",
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("exposes health and refuses a busy truth PUT until force-release", async () => {
    const app = createStudioServer(projectConfig, root);
    const health = await app.request("/api/v1/health");
    expect(health.status).toBe(200);
    const healthBody = await health.json() as { ok: boolean; projectRoot: string };
    expect(healthBody.ok).toBe(true);
    expect(healthBody.projectRoot).toBe(root);

    const first = await app.request("/api/v1/books/demo-book/truth/author_intent.md", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "# intent\n" }),
    });
    expect(first.status).toBe(200);

    const state = new StateManager(root);
    const release = await state.acquireBookLock("demo-book", {
      taskId: "hung-write",
      stage: "write",
    });
    try {
      const busy = await app.request("/api/v1/books/demo-book/truth/author_intent.md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# stolen\n" }),
      });
      expect(busy.status).toBe(409);
      const body = await busy.json() as {
        error: { code: string; message: string; owner?: { taskId?: string } };
      };
      expect(body.error.code).toBe("BOOK_BUSY");
      expect(body.error.message).toContain("not recovered automatically");
      expect(body.error.owner?.taskId).toBe("hung-write");

      const forced = await app.request("/api/v1/books/demo-book/truth/../lock".replace("truth/../", ""), {
        method: "GET",
      });
      void forced;
      const inspect = await app.request("/api/v1/books/demo-book/lock");
      expect(inspect.status).toBe(200);
      expect((await inspect.json() as { locked: boolean }).locked).toBe(true);

      const released = await app.request("/api/v1/books/demo-book/lock/force-release", {
        method: "POST",
      });
      expect(released.status).toBe(200);
      expect((await released.json() as { released: boolean }).released).toBe(true);

      const retry = await app.request("/api/v1/books/demo-book/truth/author_intent.md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# after release\n" }),
      });
      expect(retry.status).toBe(200);
    } finally {
      await release();
    }
  });
});
