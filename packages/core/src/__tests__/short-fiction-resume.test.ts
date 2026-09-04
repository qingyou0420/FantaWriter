import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ShortFictionOutlineAgent,
  ShortFictionOutlineReviewerAgent,
  ShortFictionOutlineReviserAgent,
  ShortFictionWriterAgent,
  ShortFictionDraftReviewerAgent,
  ShortFictionDraftReviserAgent,
  ShortFictionPackagingAgent,
  parseShortFictionBatchDraft,
  type ShortFictionBatchDraft,
} from "../agents/short-fiction.js";
import { runShortFictionProduction, summarizeShortFictionOutline } from "../pipeline/short-fiction-runner.js";

const CH = 12;
const DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: CH }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
${"深夜的电梯停在不存在的十三层，门开了。".repeat(50)}`).join("\n")}
`;
const PARTIAL_DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: 5 }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
${"深夜的电梯停在不存在的十三层，门开了。".repeat(20)}`).join("\n")}
`;
const MIDDLE_GAP_DRAFT_MD = `
=== SHORT_FICTION_TITLE ===
电梯多一层
${Array.from({ length: CH }, (_, i) => `=== CHAPTER ${i + 1} TITLE ===
第${i + 1}章
=== CHAPTER ${i + 1} CONTENT ===
${i === 4 || i === 7 ? "" : "深夜的电梯停在不存在的十三层，门开了。".repeat(20)}`).join("\n")}
`;
const CHAPTER_5_ONLY_CONTINUATION_MD = `
=== CHAPTER 5 TITLE ===
第5章
=== CHAPTER 5 CONTENT ===
${"第五章补写完成，电梯井里传来旧广播声。".repeat(20)}
`;

function ctx(projectRoot: string) {
  return { client: { provider: "openai" } as never, model: "fake", projectRoot };
}
function runtimes(projectRoot: string) {
  const c = ctx(projectRoot);
  return { planner: c, outlineReview: c, writer: c, draftReview: c, revise: c, package: c };
}

describe("short fiction resume + failure marker (C2)", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "inkos-shortc2-")); });
  afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });

  function stubWriteChapter(draft: ShortFictionBatchDraft) {
    return vi.spyOn(ShortFictionWriterAgent.prototype, "writeChapter").mockImplementation(async (input) => ({
      storyTitle: draft.storyTitle,
      openingHook: input.chapterNumber === 1 ? draft.openingHook : undefined,
      chapters: draft.chapters.map((chapter) => (
        chapter.number === input.chapterNumber
          ? chapter
          : { ...chapter, content: "", charCount: 0 }
      )),
      rawContent: draft.chapters.find((chapter) => chapter.number === input.chapterNumber)?.content ?? "",
    }));
  }

  function stubDownstream() {
    const draft = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    stubWriteChapter(draft);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(draft);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });
  }

  it("uses a later non-empty duplicate chapter content block when filling a previously empty chapter", () => {
    const merged = `${MIDDLE_GAP_DRAFT_MD}\n\n${CHAPTER_5_ONLY_CONTINUATION_MD}`;
    const draft = parseShortFictionBatchDraft(merged, { expectedChapters: CH });

    expect(draft.chapters[4]?.content).toContain("第五章补写完成");
    expect(findEmptyChapterNumbers(draft)).toEqual([8]);
  });

  it("resumes from an existing outline/v002.md, skipping the three outline stages", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲\n12章完整方案", "utf-8");

    const createOutline = vi.spyOn(ShortFictionOutlineAgent.prototype, "createOutline");
    const reviewOutline = vi.spyOn(ShortFictionOutlineReviewerAgent.prototype, "reviewOutline");
    stubDownstream();

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(createOutline).not.toHaveBeenCalled();   // outline resumed from disk
    expect(reviewOutline).not.toHaveBeenCalled();
    await expect(access(join(root, "shorts", "elevator", "final", "full.md"))).resolves.toBeUndefined();
    expect(result.storyId).toBe("elevator");
  });

  it("writes a failure marker (status.json) when a stage throws, instead of orphaning a silent partial", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    // Writer stage fails with a transient-style upstream error.
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeChapter").mockRejectedValue(new Error("503 temporarily unavailable"));

    await expect(runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    })).rejects.toThrow(/503/);

    const status = JSON.parse(await readFile(join(root, "shorts", "elevator", "status.json"), "utf-8"));
    expect(status.status).toBe("failed");
    expect(status.error).toContain("503");
  });

  it("keeps the complete first outline when the optional outline revision fails", async () => {
    const firstOutline = { storyTitle: "电梯多一层", rawContent: "# 电梯多一层\n\n## 12章方案\n完整第一版方案" };
    vi.spyOn(ShortFictionOutlineAgent.prototype, "createOutline").mockResolvedValue(firstOutline);
    vi.spyOn(ShortFictionOutlineReviewerAgent.prototype, "reviewOutline").mockResolvedValue("第六章需要加强反扑");
    vi.spyOn(ShortFictionOutlineReviserAgent.prototype, "reviseOutline")
      .mockRejectedValue(new Error("model reached the output limit (length)"));
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const writeChapter = stubWriteChapter(complete);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", chapterCount: CH,
      charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(writeChapter).toHaveBeenCalledWith(expect.objectContaining({ outlineMarkdown: firstOutline.rawContent, chapterNumber: 1 }));
    expect((await readFile(join(root, result.outlinePath), "utf-8")).trim()).toBe(firstOutline.rawContent);
    expect(await readFile(join(root, "shorts", result.storyId, "reviews", "outline-v002-warning.md"), "utf-8"))
      .toContain("model reached the output limit");
    const status = JSON.parse(await readFile(join(root, "shorts", result.storyId, "status.json"), "utf-8"));
    expect(status).toMatchObject({ status: "complete" });
    expect(status.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metric: "optional-revision",
        severity: "warning",
        actual: expect.stringContaining("outline revision skipped"),
      }),
    ]));
  });

  it("uses the confirmed title as project identity instead of a malformed generated heading", async () => {
    const malformedOutline = {
      storyTitle: "one-line-platform-title",
      rawContent: "# One line platform title\n\n## 12章方案\n完整方案",
    };
    vi.spyOn(ShortFictionOutlineAgent.prototype, "createOutline").mockResolvedValue(malformedOutline);
    vi.spyOn(ShortFictionOutlineReviewerAgent.prototype, "reviewOutline").mockResolvedValue("可执行");
    vi.spyOn(ShortFictionOutlineReviserAgent.prototype, "reviseOutline").mockResolvedValue(malformedOutline);
    stubDownstream();

    const result = await runShortFictionProduction({
      projectRoot: root,
      title: "《没有录音的承认》",
      direction: "现实婚姻悬疑",
      chapterCount: CH,
      charsPerChapter: 1000,
      cover: false,
      runtimes: runtimes(root),
    });

    expect(result.storyId).toBe("没有录音的承认");
    await expect(access(join(root, "shorts", "没有录音的承认", "final", "full.md"))).resolves.toBeUndefined();
    await expect(access(join(root, "shorts", "one-line-platform-title"))).rejects.toThrow();
  });

  it("writes one chapter at a time and resumes leftover empty chapters from disk", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await mkdir(join(root, "shorts", "elevator", "drafts", "v001-partial"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const partial = parseShortFictionBatchDraft(PARTIAL_DRAFT_MD, { expectedChapters: CH });
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    await writeFile(
      join(root, "shorts", "elevator", "drafts", "v001-partial", "draft.json"),
      JSON.stringify(partial),
      "utf-8",
    );
    const writeChapter = stubWriteChapter(complete);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    const writtenNumbers = writeChapter.mock.calls.map((call) => call[0]?.chapterNumber);
    expect(writtenNumbers).toEqual([6, 7, 8, 9, 10, 11, 12]);
    await expect(access(join(root, "shorts", "elevator", "drafts", "v001-partial", "full.md"))).resolves.toBeUndefined();
    const final = await readFile(join(root, "shorts", "elevator", "final", "full.md"), "utf-8");
    expect(final).toContain("第12章");
  });

  it("retries an empty chapter with continueDraft, then keeps writing the remaining chapters", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const emptyFirst = {
      ...complete,
      chapters: complete.chapters.map((chapter) => (
        chapter.number === 1 ? { ...chapter, content: "", charCount: 0 } : { ...chapter, content: "", charCount: 0 }
      )),
    };
    vi.spyOn(ShortFictionWriterAgent.prototype, "writeChapter")
      .mockResolvedValueOnce(emptyFirst)
      .mockImplementation(async (input) => ({
        storyTitle: complete.storyTitle,
        openingHook: input.chapterNumber === 1 ? complete.openingHook : undefined,
        chapters: complete.chapters.map((chapter) => (
          chapter.number === input.chapterNumber ? chapter : { ...chapter, content: "", charCount: 0 }
        )),
        rawContent: complete.chapters.find((chapter) => chapter.number === input.chapterNumber)?.content ?? "",
      }));
    const continueDraft = vi.spyOn(ShortFictionWriterAgent.prototype, "continueDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(continueDraft).toHaveBeenCalledTimes(1);
    const finalJson = JSON.parse(await readFile(join(root, "shorts", "elevator", "final", "short-story.json"), "utf-8"));
    expect(finalJson.chapters.every((chapter: { content: string }) => chapter.content.length > 0)).toBe(true);
  });

  it("keeps the complete first draft when the single revision output is invalid", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const invalidRevision = parseShortFictionBatchDraft("=== SHORT_FICTION_TITLE ===\n空改稿", { expectedChapters: CH });
    stubWriteChapter(complete);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(invalidRevision);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });

    await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    const warning = await readFile(join(root, "shorts", "elevator", "reviews", "draft-v002-warning.md"), "utf-8");
    expect(warning).toContain("第二轮改稿未采用");
    const finalJson = JSON.parse(await readFile(join(root, "shorts", "elevator", "final", "short-story.json"), "utf-8"));
    expect(finalJson.chapters.every((chapter: { content: string }) => chapter.content.length > 0)).toBe(true);
  });

  it("returns the existing short untouched when final/full.md already exists (idempotent)", async () => {
    await mkdir(join(root, "shorts", "elevator", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "final", "full.md"), "# done", "utf-8");
    const writeChapter = vi.spyOn(ShortFictionWriterAgent.prototype, "writeChapter");

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(writeChapter).not.toHaveBeenCalled();       // nothing regenerated
    expect(result.coverError).toBe("already-complete");
    expect(result.status).toBe("already-complete");
  });

  it("does not skip a previously failed run just because final/full.md exists", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await mkdir(join(root, "shorts", "elevator", "final"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 既有大纲", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "final", "full.md"), "# partial final", "utf-8");
    await writeFile(join(root, "shorts", "elevator", "status.json"), JSON.stringify({ status: "failed", error: "package failed" }), "utf-8");
    stubDownstream();
    const packageSpy = vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage");

    const result = await runShortFictionProduction({
      projectRoot: root, direction: "恐怖短篇", storyId: "elevator",
      chapterCount: CH, charsPerChapter: 1000, cover: false, runtimes: runtimes(root),
    });

    expect(result.coverError).toBe("disabled");
    expect(packageSpy).toHaveBeenCalled();
    await expect(access(join(root, "shorts", "elevator", "final", "sales-package.md"))).resolves.toBeUndefined();
  });

  it("stops after locking the outline when phase is outline", async () => {
    const firstOutline = { storyTitle: "电梯多一层", rawContent: "# 电梯多一层\n\n## 第1章 入局\n门开了。" };
    vi.spyOn(ShortFictionOutlineAgent.prototype, "createOutline").mockResolvedValue(firstOutline);
    vi.spyOn(ShortFictionOutlineReviewerAgent.prototype, "reviewOutline").mockResolvedValue("可执行");
    vi.spyOn(ShortFictionOutlineReviserAgent.prototype, "reviseOutline").mockResolvedValue(firstOutline);
    const writeChapter = vi.spyOn(ShortFictionWriterAgent.prototype, "writeChapter");
    const logs: string[] = [];

    const result = await runShortFictionProduction({
      projectRoot: root,
      direction: "恐怖短篇",
      chapterCount: CH,
      charsPerChapter: 1000,
      cover: false,
      phase: "outline",
      runtimes: runtimes(root),
      onProgress: (message) => logs.push(message),
    });

    expect(writeChapter).not.toHaveBeenCalled();
    expect(result.status).toBe("outline-ready");
    expect(result.outlineSummary).toContain("电梯多一层");
    expect(result.outlinePath).toBe(`shorts/${result.storyId}/outline/v002.md`);
    await expect(access(join(root, "shorts", result.storyId, "final", "full.md"))).rejects.toThrow();
    const status = JSON.parse(await readFile(join(root, "shorts", result.storyId, "status.json"), "utf-8"));
    expect(status).toMatchObject({ status: "needs-review", stage: "awaiting-outline-confirm" });
    expect(logs).toEqual(expect.arrayContaining([
      "正在撰写短篇大纲…",
      "正在审阅大纲…",
      "正在修订大纲…",
      "大纲已锁定，等待作者确认后再写章。",
    ]));
  });

  it("writes chapters only after a draft-phase confirm, one chapter per call", async () => {
    await mkdir(join(root, "shorts", "elevator", "outline"), { recursive: true });
    await writeFile(join(root, "shorts", "elevator", "outline", "v002.md"), "## 第1章 入局\n门开了。", "utf-8");
    const complete = parseShortFictionBatchDraft(DRAFT_MD, { expectedChapters: CH });
    const writeChapter = stubWriteChapter(complete);
    vi.spyOn(ShortFictionDraftReviewerAgent.prototype, "reviewDraft").mockResolvedValue("looks fine");
    vi.spyOn(ShortFictionDraftReviserAgent.prototype, "reviseDraft").mockResolvedValue(complete);
    vi.spyOn(ShortFictionPackagingAgent.prototype, "generatePackage").mockResolvedValue({
      title: "电梯多一层", intro: "钩子", sellingPoints: ["反转"], coverPrompt: "", rawContent: "",
    });
    const logs: string[] = [];

    const result = await runShortFictionProduction({
      projectRoot: root,
      direction: "恐怖短篇",
      storyId: "elevator",
      chapterCount: CH,
      charsPerChapter: 1000,
      cover: false,
      phase: "draft",
      runtimes: runtimes(root),
      onProgress: (message) => logs.push(message),
    });

    expect(result.status).toBe("complete");
    expect(writeChapter).toHaveBeenCalledTimes(CH);
    expect(writeChapter.mock.calls.map((call) => call[0]?.chapterNumber)).toEqual(
      Array.from({ length: CH }, (_, index) => index + 1),
    );
    expect(logs).toEqual(expect.arrayContaining([
      "正在撰写第1章（1/12）…",
      "第1章已写完（1/12）",
      "正在撰写第12章（12/12）…",
      "正在审阅全文…",
    ]));
  });

  it("summarizes a locked outline for the author review card", () => {
    const summary = summarizeShortFictionOutline("# 电梯多一层\n\n## 第1章 入局\n门开了。\n## 第2章 反扑", "zh", 12);
    expect(summary).toContain("标题：电梯多一层");
    expect(summary).toContain("章数：12");
    expect(summary).toContain("第1章 入局");
  });
});

function findEmptyChapterNumbers(draft: ReturnType<typeof parseShortFictionBatchDraft>): number[] {
  return draft.chapters.filter((chapter) => !chapter.content.trim()).map((chapter) => chapter.number);
}
