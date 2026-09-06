import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBookStage } from "./book-stage-io";

async function seedBook(root: string): Promise<string> {
  const bookDir = join(root, "old-book");
  await mkdir(join(bookDir, "story", "outline"), { recursive: true });
  await mkdir(join(bookDir, "story", "roles", "主要角色"), { recursive: true });
  await writeFile(join(bookDir, "story", "author_intent.md"), "保持冷调。\n", "utf-8");
  await writeFile(
    join(bookDir, "story", "outline", "story_frame.md"),
    ["## 世界铁律", "不可飞升。", "## 人物", "苏绻。", "## 核心冲突", "德与兵。", "## 终局", "书院重开。"].join("\n"),
    "utf-8",
  );
  await writeFile(join(bookDir, "story", "roles", "主要角色", "苏绻.md"), "# 苏绻\n", "utf-8");
  await writeFile(
    join(bookDir, "story", "outline", "volume_map.md"),
    ["## 第1卷 书院（1–10章）", "", "### 第 1 章 倒叙冷开", "落回春日。"].join("\n"),
    "utf-8",
  );
  return bookDir;
}

describe("resolveBookStage migration", () => {
  it("writes workflow.json for an old book and does not rewind to 问心", async () => {
    const root = await mkdtemp(join(tmpdir(), "inkborne-stage-"));
    const bookDir = await seedBook(root);
    const first = await resolveBookStage({
      bookDir,
      bookExists: true,
      bookStatus: "active",
      targetChapters: 200,
      nextChapter: 1,
      chaptersWritten: 0,
    });
    expect(first.stage).toBe("write");
    expect(first.steps.ask).toBe("done");
    expect(first.workflow.groundConfirmedAt).toBeTruthy();
    const saved = JSON.parse(await readFile(join(bookDir, "story", "workflow.json"), "utf-8")) as {
      lastStage?: string;
    };
    expect(saved.lastStage).toBe("write");

    const second = await resolveBookStage({
      bookDir,
      bookExists: true,
      bookStatus: "active",
      targetChapters: 200,
      nextChapter: 1,
      chaptersWritten: 0,
    });
    expect(second.stage).toBe("write");
    expect(second.workflow.groundConfirmedAt).toBe(first.workflow.groundConfirmedAt);
  });
});
