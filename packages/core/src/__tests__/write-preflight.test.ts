import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { evaluateWritePreflight, WritePreflightError, assertWritePreflight } from "../pipeline/write-preflight.js";
import { PipelineRunner } from "../pipeline/runner.js";
import { findVolumeMapEntry } from "../utils/volume-map-entry.js";

describe("G1 write preflight", () => {
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function bookDir(volumeMap: string, extras?: { storyFrame?: string; intent?: string }): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "fw-g1-"));
    temps.push(root);
    const dir = join(root, "books", "demo");
    await mkdir(join(dir, "story", "outline"), { recursive: true });
    await mkdir(join(dir, "chapters"), { recursive: true });
    await writeFile(join(dir, "story", "outline", "volume_map.md"), volumeMap, "utf-8");
    await writeFile(join(dir, "story", "outline", "story_frame.md"), extras?.storyFrame ?? "# 骨架\n\n结局方向：主角公开真相。\n", "utf-8");
    await writeFile(join(dir, "story", "author_intent.md"), extras?.intent ?? "# 作者意图\n\n写一部不漂移的连载。\n", "utf-8");
    return dir;
  }

  it("finds exact and range volume_map entries", () => {
    expect(findVolumeMapEntry("## 第 3 章 入局\n主角走进档案室。", 3)).toContain("入局");
    expect(findVolumeMapEntry("- Chapter 2-4: harbor arc", 3)).toBeTruthy();
    expect(findVolumeMapEntry("## 第 1 章 开场", 2)).toBeUndefined();
  });

  it("refuses write when volume_map has no target chapter", async () => {
    const dir = await bookDir("## 第 1 章 开场\n入局。\n");
    const evaluation = await evaluateWritePreflight({ bookDir: dir, chapterNumber: 2 });
    expect(evaluation.ok).toBe(false);
    expect(evaluation.reasons.map((reason) => reason.code)).toContain("missing_volume_map_entry");
    expect(() => assertWritePreflight(evaluation)).toThrow(WritePreflightError);
  });

  it("refuses empty story_frame and placeholder author_intent", async () => {
    const dir = await bookDir("## 第 1 章 开场\n入局。\n", {
      storyFrame: "",
      intent: "# 作者意图\n\n（在这里描述这本书的长期创作方向。）\n",
    });
    const evaluation = await evaluateWritePreflight({ bookDir: dir, chapterNumber: 1 });
    expect(evaluation.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["empty_story_frame", "empty_author_intent"]),
    );
  });

  it("refuses when previous chapter is not approved unless skip is set", async () => {
    const dir = await bookDir("## 第 2 章 续写\n推进。\n");
    const blocked = await evaluateWritePreflight({
      bookDir: dir,
      chapterNumber: 2,
      previousChapter: { number: 1, status: "ready-for-review" },
    });
    expect(blocked.reasons.map((reason) => reason.code)).toContain("previous_chapter_not_approved");

    const skipped = await evaluateWritePreflight({
      bookDir: dir,
      chapterNumber: 2,
      previousChapter: { number: 1, status: "ready-for-review" },
      skipPreviousApproval: true,
    });
    expect(skipped.ok).toBe(true);
  });

  it("treats imported previous chapters as settled", async () => {
    const dir = await bookDir("## 第 2 章 续写\n推进。\n");
    const evaluation = await evaluateWritePreflight({
      bookDir: dir,
      chapterNumber: 2,
      previousChapter: { number: 1, status: "imported" },
    });
    expect(evaluation.ok).toBe(true);
  });

  it("writeDraft and writeNextChapter refuse before LLM when G1 fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-g1-run-"));
    temps.push(root);
    const dir = join(root, "books", "demo");
    await mkdir(join(dir, "story", "outline"), { recursive: true });
    await mkdir(join(dir, "chapters"), { recursive: true });
    await writeFile(join(dir, "book.json"), JSON.stringify({
      id: "demo",
      title: "Demo",
      platform: "other",
      genre: "other",
      status: "active",
      targetChapters: 10,
      chapterWordCount: 2000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }), "utf-8");
    await writeFile(join(dir, "story", "outline", "volume_map.md"), "# 卷\n\n还没排到第 1 章。\n", "utf-8");
    await writeFile(join(dir, "story", "outline", "story_frame.md"), "", "utf-8");
    await writeFile(join(dir, "story", "author_intent.md"), "", "utf-8");

    const runner = new PipelineRunner({
      client: { complete: async () => { throw new Error("llm unused"); } } as never,
      model: "test",
      projectRoot: root,
    });

    await expect(runner.writeDraft("demo")).rejects.toMatchObject({ code: "WRITE_PREFLIGHT" });
    await expect(runner.writeNextChapter("demo")).rejects.toMatchObject({ code: "WRITE_PREFLIGHT" });
  });
});
