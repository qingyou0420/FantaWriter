import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  MAX_CHAPTER_VERSIONS,
  assertWritingBoardImmutable,
  createEmptyProject,
  defaultVolumeId,
  mergeTags,
  normalizeLearnedStyle,
  normalizeProject,
  parseTagsFromText,
  pushChapterVersion,
  type ChapterContent,
  type LearnedStyle,
  type NovelProject,
} from "./types";

describe("parseTagsFromText", () => {
  it("splits slash / comma / newline and dedupes", () => {
    expect(parseTagsFromText("口交/肛交/口交，舔阴\n女同")).toEqual([
      "口交",
      "肛交",
      "舔阴",
      "女同",
    ]);
  });

  it("returns empty for blank input", () => {
    expect(parseTagsFromText("")).toEqual([]);
    expect(parseTagsFromText("   ")).toEqual([]);
  });
});

describe("mergeTags", () => {
  it("merges and dedupes in order", () => {
    expect(mergeTags(["A", "B"], ["B", "C"], undefined)).toEqual(["A", "B", "C"]);
  });
});

describe("createEmptyProject / defaultVolumeId", () => {
  it("defaults writingBoard to erotic and schemaVersion 2", () => {
    const p = createEmptyProject("测试");
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.writingBoard).toBe("erotic");
    expect(p.contentRating).toBe("adult");
    expect(p.volumes?.[0]?.id).toBe(defaultVolumeId(p.id));
  });

  it("accepts general board", () => {
    const p = createEmptyProject("常规", "general");
    expect(p.writingBoard).toBe("general");
    expect(p.contentRating).toBe("unrated");
    expect(p.volumes?.[0]?.id).toBe(`${p.id}:vol:1`);
  });
});

describe("normalizeProject", () => {
  it("maps 1.8.1 payloads to erotic + schemaVersion 2 + deterministic volume", () => {
    const id = "proj-aaa";
    const raw = {
      id,
      name: "旧色情书",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      characters: [],
      background: {
        title: "",
        synopsis: "",
        setting: "",
        era: "现代",
        themes: "",
        tone: "",
        extra: "",
      },
      settings: {
        eroticLevel: 4,
        writingStyle: "plain",
        customStyle: "",
        person: "third",
        length: "medium",
        language: "zh",
        chapterCount: 5,
        extraInstructions: "",
      },
      outline: {
        premise: "p",
        endingNote: "e",
        chapters: [
          {
            id: "ch1",
            order: 1,
            title: "一",
            summary: "s",
            keyPoints: "k",
            eroticNote: "",
            intensityNote: "紧张",
          },
        ],
      },
      chapters: [{ chapterId: "ch1", title: "一", content: "正文", status: "done", updatedAt: "" }],
    } as unknown as NovelProject;

    const a = normalizeProject(raw);
    const b = normalizeProject(a);
    expect(a.writingBoard).toBe("erotic");
    expect(a.schemaVersion).toBe(2);
    expect(a.volumes?.[0]?.id).toBe("proj-aaa:vol:1");
    expect(a.outline?.chapters[0].volumeId).toBe("proj-aaa:vol:1");
    expect(a.outline?.chapters[0].eroticNote).toBe("紧张");
    expect(b.volumes?.[0]?.id).toBe(a.volumes?.[0]?.id);
    expect(a.settings.learnedStyleId).toBe("");
    expect(a.settings.eroticLevel).toBe(4);
  });

  it("does not overwrite writingBoard=general", () => {
    const p = normalizeProject(createEmptyProject("g", "general"));
    expect(p.writingBoard).toBe("general");
    expect(p.contentRating).toBe("unrated");
  });

  it("defaults missing original/canon without breaking old books", () => {
    const p = normalizeProject(createEmptyProject("g", "general"));
    expect(p.original).toBeNull();
    expect(p.canon).toEqual([]);
  });
});

describe("assertWritingBoardImmutable", () => {
  it("allows same-board upserts", () => {
    const p = createEmptyProject("a");
    expect(() => assertWritingBoardImmutable(p, { ...p, name: "b" })).not.toThrow();
  });

  it("throws WRITING_BOARD_LOCKED on silent board change", () => {
    const prev = createEmptyProject("a", "erotic");
    const next = { ...prev, writingBoard: "general" as const };
    expect(() => assertWritingBoardImmutable(prev, next)).toThrow("WRITING_BOARD_LOCKED");
  });
});

describe("normalizeLearnedStyle", () => {
  it("defaults missing board to erotic", () => {
    const s = normalizeLearnedStyle({
      id: "s1",
      name: "旧",
      createdAt: "",
      updatedAt: "",
      sourceLabel: "",
      sourceChars: 0,
      overall: "",
      vocabulary: "",
      rhythm: "",
      narrative: "",
      dialogue: "",
      sensory: "",
      structure: "",
      avoid: "",
      styleGuide: "",
      fingerprints: [],
    } as unknown as LearnedStyle);
    expect(s.writingBoard).toBe("erotic");
  });
});

describe("legacyProject helper sanity", () => {
  it("createEmptyProject still works without second arg (home page)", () => {
    const p = createEmptyProject();
    expect(p.name).toBe("未命名小说");
    expect(p.writingBoard).toBe("erotic");
  });
});

describe("pushChapterVersion", () => {
  it("keeps at most MAX_CHAPTER_VERSIONS = 12 snapshots", () => {
    expect(MAX_CHAPTER_VERSIONS).toBe(12);
    let ch: ChapterContent = {
      chapterId: "c1",
      title: "一",
      content: "v0",
      status: "done",
      updatedAt: "",
      versions: [],
    };
    for (let i = 1; i <= 15; i++) {
      ch = pushChapterVersion({ ...ch, content: `body-${i}` }, "auto");
    }
    expect(ch.versions).toHaveLength(12);
    expect(ch.versions?.[0].content).toBe("body-15");
    expect(ch.versions?.[11].content).toBe("body-4");
  });
});
