import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHAPTER_EXPORT_SUBDIR,
  assertSafeRelativePath,
  bookExportFolderName,
  buildChapterMarkdown,
  buildChapterRepoFiles,
  chapterRepoFileName,
  chapterRepoRelativePath,
  isFinishedChapter,
  normalizeExportSubdir,
  parseChapterMarkdown,
  sanitizePathSegment,
  selectChaptersForRepoExport,
} from "./export-chapters";
import { createEmptyProject, type NovelProject, type OutlineChapter } from "./types";

function chapter(
  id: string,
  order: number,
  title: string,
  volumeId?: string
): OutlineChapter {
  return {
    id,
    order,
    title,
    summary: "",
    keyPoints: "",
    eroticNote: "",
    tags: [],
    volumeId,
  };
}

function projectWith(
  board: NovelProject["writingBoard"],
  outline: OutlineChapter[],
  bodies: {
    id: string;
    content: string;
    status: NovelProject["chapters"][number]["status"];
  }[]
): NovelProject {
  const p = createEmptyProject("常规书");
  p.id = "proj-export-1";
  p.background.title = "测试长篇";
  p.outline = { premise: "", endingNote: "", chapters: outline };
  p.chapters = bodies.map((b) => ({
    chapterId: b.id,
    title: outline.find((c) => c.id === b.id)?.title || "",
    content: b.content,
    status: b.status,
    updatedAt: "2026-08-20T00:00:00.000Z",
  }));
  return p;
}

describe("sanitizePathSegment", () => {
  it("replaces reserved filesystem characters", () => {
    expect(sanitizePathSegment('a/b\\c:d*e?f"g<h>i|j')).toBe(
      "a_b_c_d_e_f_g_h_i_j"
    );
  });

  it("strips control characters and trailing dots/spaces", () => {
    expect(sanitizePathSegment("  好章.\t.\n")).toBe("好章");
    expect(sanitizePathSegment("hi\u0000there")).toBe("hi there");
  });

  it("rejects Windows reserved names and empty input", () => {
    expect(sanitizePathSegment("CON")).toBe("untitled");
    expect(sanitizePathSegment("..")).toBe("untitled");
    expect(sanitizePathSegment("   ")).toBe("untitled");
    expect(sanitizePathSegment("nul", "fallback")).toBe("fallback");
    expect(sanitizePathSegment('<>:"/\\|?*', "fallback")).toBe("fallback");
  });

  it("caps length", () => {
    const long = "章".repeat(120);
    expect(sanitizePathSegment(long).length).toBeLessThanOrEqual(80);
  });
});

describe("relative path safety", () => {
  it("normalizes and rejects traversal", () => {
    expect(assertSafeRelativePath("novels/foo/bar.md")).toBe("novels/foo/bar.md");
    expect(() => assertSafeRelativePath("../etc/passwd")).toThrow(/非法/);
    expect(() => assertSafeRelativePath("/tmp/x")).toThrow(/绝对/);
    expect(() => assertSafeRelativePath("C:\\novels")).toThrow(/绝对/);
  });

  it("defaults subdir to novels; empty means repo root", () => {
    expect(normalizeExportSubdir(undefined)).toBe(DEFAULT_CHAPTER_EXPORT_SUBDIR);
    expect(normalizeExportSubdir("  ")).toBe("");
    expect(normalizeExportSubdir("drafts/md")).toBe("drafts/md");
    expect(() => normalizeExportSubdir("../x")).toThrow();
  });
});

describe("chapter / book file names", () => {
  it("names the file by chapter id so title/order edits still overwrite", () => {
    const ch = chapter("c1-uuid-aaaa", 3, "第一夜");
    expect(chapterRepoFileName(ch)).toBe("ch-c1-uuid-aaaa.md");
    expect(chapterRepoFileName({ ...ch, title: "第一夜 / 修订", order: 9 })).toBe(
      "ch-c1-uuid-aaaa.md"
    );
  });

  it("puts files under novels/<book-title>/", () => {
    const p = projectWith("general", [chapter("c1", 1, "开端")], [
      { id: "c1", content: "正文", status: "done" },
    ]);
    expect(bookExportFolderName(p)).toBe("测试长篇");
    expect(chapterRepoRelativePath(p, p.outline!.chapters[0])).toBe(
      "novels/测试长篇/ch-c1.md"
    );
  });

  it("falls back when book title is empty or unsafe", () => {
    const p = createEmptyProject("未命名小说");
    p.id = "abcdef12-xxxx";
    p.background.title = '<>:"/\\|?*';
    expect(bookExportFolderName(p)).toBe("book-abcdef12");
    p.background.title = "";
    p.name = "";
    expect(bookExportFolderName(p)).toBe("book-abcdef12");
  });
});

describe("selectChaptersForRepoExport", () => {
  const outline = [
    chapter("a", 1, "一"),
    chapter("b", 2, "二"),
    chapter("c", 3, "三"),
  ];
  const p = projectWith("general", outline, [
    { id: "a", content: "完成的一", status: "done" },
    { id: "b", content: "草稿二", status: "idle" },
    { id: "c", content: "", status: "done" },
  ]);

  it("exports only status===done chapters that have prose", () => {
    const selected = selectChaptersForRepoExport(p, "done");
    expect(selected.map((c) => c.id)).toEqual(["a"]);
    expect(isFinishedChapter(p, "a")).toBe(true);
    expect(isFinishedChapter(p, "b")).toBe(false);
    expect(isFinishedChapter(p, "c")).toBe(false);
  });

  it("exports the current chapter even if not done, when it has body", () => {
    const selected = selectChaptersForRepoExport(p, "current", "b");
    expect(selected.map((c) => c.id)).toEqual(["b"]);
  });

  it("rejects current chapter without body or missing id", () => {
    expect(() => selectChaptersForRepoExport(p, "current", "c")).toThrow(
      /尚无正文/
    );
    expect(() => selectChaptersForRepoExport(p, "current")).toThrow(/选择/);
  });

  it("rejects done-export when nothing is finished", () => {
    const empty = projectWith("general", [chapter("x", 1, "空")], [
      { id: "x", content: "", status: "idle" },
    ]);
    expect(() => selectChaptersForRepoExport(empty, "done")).toThrow(/没有已完成/);
  });

  it("exports finished chapters from a conventional project", () => {
    const g = projectWith("general", [chapter("g1", 1, "章")], [
      { id: "g1", content: "常规正文", status: "done" },
    ]);
    expect(selectChaptersForRepoExport(g, "done")).toHaveLength(1);
    expect(g.writingBoard).toBe("general");
  });
});

describe("chapter markdown payload", () => {
  it("keeps prose as the body and enough metadata to rematch", () => {
    const p = projectWith(
      "general",
      [chapter("ch-42", 2, "夜行", "vol-custom")],
      [{ id: "ch-42", content: "第一段。\n\n第二段。", status: "done" }]
    );
    p.volumes = [
      { id: "vol-custom", order: 1, title: "中卷", summary: "" },
    ];
    p.outline!.chapters[0].volumeId = "vol-custom";

    const md = buildChapterMarkdown(p, p.outline!.chapters[0], "2026-08-20T12:00:00.000Z");
    expect(md).toContain("format: fantawriter-chapter");
    expect(md).toContain("chapterId: \"ch-42\"");
    expect(md).toContain("bookTitle: \"测试长篇\"");
    expect(md).toContain("order: 2");
    expect(md).toContain("# 第 2 章 夜行");
    expect(md).toContain("第一段。\n\n第二段。");
    expect(md).not.toContain("characters");
    expect(md).not.toContain(JSON.stringify(p));

    const parsed = parseChapterMarkdown(md);
    expect(parsed.meta.chapterId).toBe("ch-42");
    expect(parsed.meta.projectId).toBe(p.id);
    expect(parsed.meta.bookTitle).toBe("测试长篇");
    expect(parsed.meta.chapterTitle).toBe("夜行");
    expect(parsed.meta.order).toBe(2);
    expect(parsed.meta.volumeTitle).toBe("中卷");
    expect(parsed.meta.writingBoard).toBe("general");
    expect(parsed.prose).toBe("第一段。\n\n第二段。");
  });

  it("builds one file per selected chapter under the configured subdir", () => {
    const p = projectWith(
      "general",
      [chapter("a", 1, "一"), chapter("b", 2, "二")],
      [
        { id: "a", content: "甲", status: "done" },
        { id: "b", content: "乙", status: "done" },
      ]
    );
    const files = buildChapterRepoFiles(
      p,
      selectChaptersForRepoExport(p, "done"),
      "novels"
    );
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath)).toEqual([
      "novels/测试长篇/ch-a.md",
      "novels/测试长篇/ch-b.md",
    ]);
    expect(files[0].content).toContain("甲");
    expect(files[1].content).toContain("乙");
  });
});
