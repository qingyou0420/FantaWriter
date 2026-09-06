import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { persistAskArtifacts } from "./ask-artifacts";
import { parseStoryCard } from "./story-card";
import { loadBookWorkflow } from "./book-stage-io";

describe("persistAskArtifacts", () => {
  it("writes story_card.md, author_intent.md, and askConfirmedAt", async () => {
    const bookDir = await mkdtemp(join(tmpdir(), "ask-artifacts-"));
    await persistAskArtifacts({
      bookDir,
      card: { workingTitle: "醉词", oneLine: "书院群像", synopsis: "春日入堂" },
      language: "zh",
      nowIso: "2026-09-06T00:00:00.000Z",
    });
    const card = parseStoryCard(await readFile(join(bookDir, "story", "story_card.md"), "utf-8"));
    expect(card.workingTitle).toBe("醉词");
    const intent = await readFile(join(bookDir, "story", "author_intent.md"), "utf-8");
    expect(intent).toMatch(/暂定书名：醉词/);
    const workflow = await loadBookWorkflow(bookDir);
    expect(workflow?.askConfirmedAt).toBe("2026-09-06T00:00:00.000Z");
  });
});
