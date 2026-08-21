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
    expect(parseTagsFromText("悬疑/科幻/悬疑，奇幻\n都市")).toEqual([
      "悬疑",
      "科幻",
      "奇幻",
      "都市",
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
  it("defaults writingBoard to general and schemaVersion 2", () => {
    const p = createEmptyProject("测试");
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.writingBoard).toBe("general");
    expect(p.contentRating).toBe("unrated");
    expect(p.volumes?.[0]?.id).toBe(defaultVolumeId(p.id));
  });
});

describe("normalizeProject", () => {
  it("maps old payloads to general + schemaVersion 2 + deterministic volume", () => {
    const id = "proj-aaa";
    const raw = {
      id,
      name: "旧书",
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
    expect(a.writingBoard).toBe("general");
    expect(a.schemaVersion).toBe(2);
    expect(a.volumes?.[0]?.id).toBe("proj-aaa:vol:1");
    expect(a.outline?.chapters[0].volumeId).toBe("proj-aaa:vol:1");
    expect(a.outline?.chapters[0].intensityNote).toBe("紧张");
    expect(b.volumes?.[0]?.id).toBe(a.volumes?.[0]?.id);
    expect(a.settings.learnedStyleId).toBe("");
    expect(a.settings.eroticLevel).toBe(4);
  });

  it("keeps writingBoard=general", () => {
    const p = normalizeProject(createEmptyProject("g"));
    expect(p.writingBoard).toBe("general");
    expect(p.contentRating).toBe("unrated");
  });

  it("defaults missing original/canon without breaking old books", () => {
    const p = normalizeProject(createEmptyProject("g"));
    expect(p.original).toBeNull();
    expect(p.canon).toEqual([]);
  });
});

describe("assertWritingBoardImmutable", () => {
  it("allows same-board upserts", () => {
    const p = createEmptyProject("a");
    expect(() => assertWritingBoardImmutable(p, { ...p, name: "b" })).not.toThrow();
  });
});

describe("normalizeLearnedStyle", () => {
  it("defaults missing board to general", () => {
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
    expect(s.writingBoard).toBe("general");
  });
});

describe("legacyProject helper sanity", () => {
  it("createEmptyProject still works without second arg (home page)", () => {
    const p = createEmptyProject();
    expect(p.name).toBe("未命名小说");
    expect(p.writingBoard).toBe("general");
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
