import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("P1 studio gates", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "fw-p1-api-"));
    await mkdir(join(root, "books", "demo-book", "story", "outline"), { recursive: true });
    await mkdir(join(root, "books", "demo-book", "chapters"), { recursive: true });
    await mkdir(join(root, ".inkos"), { recursive: true });
    await writeFile(join(root, "inkos.json"), JSON.stringify(projectConfig, null, 2), "utf-8");
    await writeFile(join(root, ".inkos", "secrets.json"), JSON.stringify({ services: { custom: { apiKey: "sk-test" } } }), "utf-8");
    await writeFile(join(root, "books", "demo-book", "book.json"), JSON.stringify({
      id: "demo-book",
      title: "Demo",
      platform: "other",
      genre: "other",
      status: "active",
      targetChapters: 10,
      chapterWordCount: 2000,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    }), "utf-8");
    await writeFile(join(root, "books", "demo-book", "story", "outline", "volume_map.md"), "# 卷\n", "utf-8");
    await writeFile(join(root, "books", "demo-book", "story", "outline", "story_frame.md"), "", "utf-8");
    await writeFile(join(root, "books", "demo-book", "story", "author_intent.md"), "", "utf-8");
    await writeFile(join(root, "books", "demo-book", "chapters", "index.json"), JSON.stringify([
      {
        number: 1,
        title: "Broken",
        status: "ready-for-review",
        wordCount: 1200,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        auditIssues: ["[critical] OOC"],
        lengthWarnings: [],
      },
    ]), "utf-8");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("refuses write-next when G1 fails", async () => {
    const app = createStudioServer(projectConfig, root);
    const response = await app.request("/api/v1/books/demo-book/write-next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(409);
    const body = await response.json() as { error: { code: string; details?: { reasons?: Array<{ code: string }> } } };
    expect(body.error.code).toBe("WRITE_PREFLIGHT");
    expect(body.error.details?.reasons?.some((reason) => reason.code === "missing_volume_map_entry")).toBe(true);
  });

  it("blocks approve when critical issues exist", async () => {
    const app = createStudioServer(projectConfig, root);
    const response = await app.request("/api/v1/books/demo-book/chapters/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(409);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("APPROVE_BLOCKED");
  });

  it("approves after an explicit override", async () => {
    const app = createStudioServer(projectConfig, root);
    const response = await app.request("/api/v1/books/demo-book/chapters/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override: { who: "author", why: "带病定稿" } }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { status: string; override?: { why: string } };
    expect(body.status).toBe("approved");
    expect(body.override?.why).toBe("带病定稿");
  });
});
