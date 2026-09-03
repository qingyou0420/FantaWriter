import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PipelineRunner, VolumeMapWeaveError } from "@actalk/inkos-core";
import { createStudioServer } from "./server.js";

const projectConfig = {
  name: "test",
  version: "0.1.0",
  language: "zh",
  llm: {
    provider: "custom",
    service: "custom",
    configSource: "studio",
    baseUrl: "https://example.com/v1",
    model: "test-model",
    apiFormat: "chat",
    stream: true,
    services: [
      {
        service: "custom",
        name: "Custom",
        baseUrl: "https://example.com/v1",
        models: ["test-model"],
      },
    ],
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
    await writeFile(join(root, ".inkos", "secrets.json"), JSON.stringify({ services: { "custom:Custom": { apiKey: "sk-test" } } }), "utf-8");
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
    vi.restoreAllMocks();
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

  it("weaves a full outline tree through the confirm gate", async () => {
    vi.spyOn(PipelineRunner.prototype, "weaveVolumeMap").mockResolvedValue({
      markdown: "## 第1卷 试炼（1-2章）\nObjective：开局。\n\n## 第 1 章 入局\n走进酒楼。\n\n## 第 2 章 夜谈\n听见旧案。\n",
      volumeCount: 1,
      chapterCount: 2,
      proposal: {
        id: "prop-1",
        bookId: "demo-book",
        fileName: "outline/volume_map.md",
        authority: "foundation",
        baseRevision: "abc",
        currentContent: "# 卷\n",
        proposedContent: "## 第1卷 试炼（1-2章）\n",
        unifiedDiff: "--- a\n+++ b\n",
        status: "pending",
        createdAt: "2026-09-03T00:00:00.000Z",
        updatedAt: "2026-09-03T00:00:00.000Z",
      },
    });
    const app = createStudioServer(projectConfig, root);
    const response = await app.request("/api/v1/books/demo-book/outline/weave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "batch" }),
    });
    const body = await response.json() as { proposal?: { id: string; fileName: string }; chapterCount?: number; error?: string };
    expect(response.status, body.error ?? JSON.stringify(body)).toBe(200);
    expect(body.chapterCount).toBe(2);
    expect(body.proposal?.fileName).toBe("outline/volume_map.md");
  });

  it("returns a 500 when the weave worker abort fires instead of hanging", async () => {
    vi.spyOn(PipelineRunner.prototype, "weaveVolumeMap").mockRejectedValue(
      new VolumeMapWeaveError("织卷失败：第1卷 冕旒 第1–10章 — LLM stream produced no token for 60000ms 已完成 0/260 章。可再点织卷补 remaining。", {
        volumeNumber: 1,
        volumeCount: 7,
        volumeTitle: "冕旒",
        chapterStart: 1,
        chapterEnd: 10,
        completedVolumes: 0,
        completedChapters: 0,
        targetChapters: 260,
        generatedChapterNumbers: [],
      }),
    );
    const app = createStudioServer(projectConfig, root);
    const response = await app.request("/api/v1/books/demo-book/outline/weave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "batch" }),
    });
    const body = await response.json() as {
      error?: string;
      failedVolume?: number;
      failedChapters?: number[];
    };
    expect(response.status).toBe(500);
    expect(body.error).toContain("第1–10章");
    expect(body.failedVolume).toBe(1);
    expect(body.failedChapters).toEqual([1, 10]);
  });
});
