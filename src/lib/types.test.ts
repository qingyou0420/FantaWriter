import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  LENGTH_RANGES,
  MAX_CHAPTER_VERSIONS,
  assertWritingBoardImmutable,
  createEmptyProject,
  defaultVolumeId,
  normalizeCharacter,
  mergeTags,
  normalizeLearnedStyle,
  normalizeProject,
  parseTagsFromText,
  pushChapterVersion,
  resolveChapterTemperature,
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

describe("LENGTH_RANGES", () => {
  it("pins long-band floors used by chapter prompts", () => {
    expect(LENGTH_RANGES.long.min).toBe(3000);
    expect(LENGTH_RANGES.long.max).toBe(5000);
  });
});

describe("createEmptyProject / defaultVolumeId", () => {
  it("defaults writingBoard to general and schemaVersion 3", () => {
    const p = createEmptyProject("测试");
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(p.writingBoard).toBe("general");
    expect(p.contentRating).toBe("unrated");
    expect(p.volumes?.[0]?.id).toBe(defaultVolumeId(p.id));
    expect(p.settings.learnedStyleFingerprints).toEqual([]);
    expect(p.settings.temperature).toBe(0.9);
    expect(p.settings.serialMode).toBe(true);
    expect(p.premiseCard?.forbidList).toEqual([]);
  });

  it("serializes a new project without erotic leftovers", () => {
    const json = JSON.stringify(createEmptyProject("新书"));
    expect(json.toLowerCase()).not.toMatch(/erotic/);
  });
});

describe("normalizeProject", () => {
  it("maps old payloads to general + schemaVersion 3 + deterministic volume", () => {
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
    expect(a.schemaVersion).toBe(3);
    expect(a.volumes?.[0]?.id).toBe("proj-aaa:vol:1");
    expect(a.outline?.chapters[0].volumeId).toBe("proj-aaa:vol:1");
    expect(a.outline?.chapters[0].intensityNote).toBe("紧张");
    expect(b.volumes?.[0]?.id).toBe(a.volumes?.[0]?.id);
    expect(a.settings.learnedStyleId).toBe("");
    expect(a.settings.learnedStyleFingerprints).toEqual([]);
    expect(a.settings.eroticLevel).toBe(4);
    expect(a.outline?.chapters[0].castIds).toEqual([]);
    expect(a.settings.serialMode).toBe(false);
    expect(a.outline?.chapters[0].hook).toBe("");
    expect(a.characterStates).toEqual({});
    expect(a.premiseCard?.premise).toBe("p");
    expect(a.chapters[0].reviewState).toBeUndefined();
    expect(a.chapters[0].publishedAt).toBeUndefined();
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

  it("fills missing character fields and seeds a card when the list is absent", () => {
    const n = normalizeProject({
      id: "no-cast",
      name: "从零",
      createdAt: "",
      updatedAt: "",
    } as unknown as NovelProject);
    expect(n.characters).toHaveLength(1);
    expect(n.characters[0].id).toBeTruthy();
    expect(n.characters[0].name).toBe("");
    expect(n.characters[0].role).toBe("主角");

    const partial = normalizeCharacter({ name: "甲" });
    expect(partial.id).toBeTruthy();
    expect(partial.name).toBe("甲");
    expect(partial.gender).toBe("");
    expect(partial.aliases).toEqual([]);
  });

  it("normalizes plot thread visibility and beat scenes", () => {
    const p = createEmptyProject("线");
    p.plotThreads = [
      {
        id: "d1",
        title: "暗线",
        note: "",
        status: "planted",
        createdAt: "",
        updatedAt: "",
        kind: "dark",
      },
    ];
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "",
        status: "idle",
        updatedAt: "",
        scenes: [
          {
            id: "s1",
            order: 1,
            title: "上桥",
            summary: "黎明",
            verbatimAnchors: ["霜桥第三块石缺了一角"],
          },
        ],
      },
    ];
    const n = normalizeProject(p);
    expect(n.plotThreads?.[0].visibility).toBe("author_only");
    expect(n.chapters[0].scenes?.[0].status).toBe("pending");
    expect(n.chapters[0].scenes?.[0].verbatimAnchors).toEqual([
      "霜桥第三块石缺了一角",
    ]);
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

describe("resolveChapterTemperature", () => {
  it("defaults to 0.9 and passes through a slider value", () => {
    expect(resolveChapterTemperature(undefined)).toBe(0.9);
    expect(resolveChapterTemperature({ temperature: 0.7 })).toBe(0.7);
    expect(resolveChapterTemperature({ temperature: Number.NaN })).toBe(0.9);
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
