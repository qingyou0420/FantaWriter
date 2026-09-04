import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listStudioShorts, loadStudioShort } from "./short-library.js";

describe("short library", () => {
  it("lists completed and in-progress shorts without treating them as books", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkos-shorts-"));
    await mkdir(join(root, "shorts", "明日来信", "final"), { recursive: true });
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "明日来信", "brief.json"), JSON.stringify({
      storyId: "明日来信",
      title: "明日来信",
      chapterCount: 12,
    }), "utf-8");
    await writeFile(join(root, "shorts", "明日来信", "status.json"), JSON.stringify({
      status: "complete",
      stage: "complete",
      id: "明日来信",
    }), "utf-8");
    await writeFile(join(root, "shorts", "明日来信", "final", "full.md"), "# 明日来信\n\n终稿。", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "brief.json"), JSON.stringify({
      storyId: "elevator",
      title: "电梯多一层",
      chapterCount: 12,
    }), "utf-8");
    await writeFile(join(root, "shorts", "elevator", "status.json"), JSON.stringify({
      status: "needs-review",
      stage: "awaiting-outline-confirm",
    }), "utf-8");
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 大纲", "utf-8");

    const listed = await listStudioShorts(root);
    expect(listed.map((item) => ({ id: item.id, status: item.status, kind: item.kind }))).toEqual([
      { id: "elevator", status: "outlining", kind: "short" },
      { id: "明日来信", status: "completed", kind: "short" },
    ]);
    expect(listed.find((item) => item.id === "明日来信")?.manuscriptPath).toBe("shorts/明日来信/final/full.md");

    const finished = await loadStudioShort(root, "明日来信");
    expect(finished).toMatchObject({
      title: "明日来信",
      contentKind: "manuscript",
      content: expect.stringContaining("终稿"),
    });
    const outline = await loadStudioShort(root, "elevator");
    expect(outline).toMatchObject({
      title: "电梯多一层",
      contentKind: "outline",
      status: "outlining",
    });
  });
});
