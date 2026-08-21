import { describe, expect, it } from "vitest";
import { generateBody } from "./api";
import {
  attachOriginalContext,
  buildOriginalGrounding,
  detectCanonViolations,
  detectCharacterCanonViolations,
  excerptKeysFromPayload,
  formatLockedCanon,
  hasOriginalGrounding,
  injectOriginalGrounding,
  LOCKED_CANON_HEADING,
  ORIGINAL_GROUNDING_HEADING,
  ORIGINAL_SYSTEM_RULE,
  parseCanonFacts,
  selectOriginalExcerpts,
} from "./original";
import { assemble } from "./prompts/registry";
import { exportProjectJson, importProjectJson } from "./storage";
import {
  createEmptyCharacter,
  createEmptyProject,
  normalizeProject,
  type LockedCanonFact,
  type NovelProject,
  type OriginalManuscript,
} from "./types";

const QINGXI_LOCK: LockedCanonFact = {
  id: "lock-qingxi",
  name: "清溪",
  kind: "identity",
  statement: "流渊的白色战马，不是人，不是女性。",
  locked: true,
  aliases: [],
};

const ZUI_CI_SNIPPET = `流渊勒住缰绳。身下那匹通体雪白的战马名为清溪，踏雪无声。
清溪不是人，是他从北境带回来的坐骑。马鬃被夜风吹起，像一道冷白的水。
帐中有人低声唤「清溪」，他才意识到他们把马的名字叫得太亲。`;

function renewProject(): NovelProject {
  const p = createEmptyProject("醉词焕新", "general");
  p.original = {
    title: "醉词",
    sourceLabel: "粘贴导入",
    text: ZUI_CI_SNIPPET,
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
  p.canon = [QINGXI_LOCK];
  p.characters = [
    {
      ...createEmptyCharacter(),
      name: "清溪",
      role: "",
      gender: "",
    },
  ];
  return normalizeProject(p);
}

describe("empty original keeps old projects", () => {
  it("createEmptyProject has no original grounding", () => {
    const p = createEmptyProject("从零");
    expect(p.original).toBeNull();
    expect(p.canon).toEqual([]);
    expect(hasOriginalGrounding(p)).toBe(false);
  });

  it("normalizeProject fills missing original/canon on 1.8-style payloads", () => {
    const raw = {
      id: "old-1",
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
        eroticLevel: 3,
        writingStyle: "plain",
        customStyle: "",
        person: "third",
        length: "medium",
        language: "zh",
        chapterCount: 5,
        extraInstructions: "",
      },
      outline: null,
      chapters: [],
    } as unknown as NovelProject;
    const n = normalizeProject(raw);
    expect(n.original).toBeNull();
    expect(n.canon).toEqual([]);
    expect(hasOriginalGrounding(n)).toBe(false);
  });

  it("assemble outline/character/chapter without original has no grounding headings", () => {
    const p = createEmptyProject("旧");
    const chapter = {
      id: "c1",
      order: 1,
      title: "一",
      summary: "摘要",
      keyPoints: "点",
      eroticNote: "无",
      tags: [] as string[],
    };
    for (const task of ["outline", "expand_character", "chapter"] as const) {
      const { user, system } = assemble(task, "general", {
        characters: p.characters,
        background: p.background,
        settings: p.settings,
        outline: { premise: "p", endingNote: "e", chapters: [chapter] },
        chapter,
        projectTags: [],
        seed: "灵感",
        character: p.characters[0],
      });
      const blob = system + "\n" + user;
      expect(blob).not.toContain(LOCKED_CANON_HEADING);
      expect(blob).not.toContain(ORIGINAL_GROUNDING_HEADING);
      expect(blob).not.toContain("原作焕新（硬性）");
    }
  });
});

describe("fact lock survives generation payload", () => {
  it("generateBody / attachOriginalContext keep locked 清溪", () => {
    const p = renewProject();
    const body = generateBody(p, "expand_character", {
      seed: "清溪",
      character: p.characters[0],
    });
    const canon = body.canon as LockedCanonFact[] | undefined;
    const original = body.original as OriginalManuscript | undefined;
    expect(canon).toHaveLength(1);
    expect(canon?.[0].name).toBe("清溪");
    expect(canon?.[0].statement).toContain("白色战马");
    expect(canon?.[0].locked).toBe(true);
    expect(original?.title).toBe("醉词");
    expect(original?.text).toContain("清溪");

    const attached = attachOriginalContext(p, { mode: "chapter" });
    expect(attached.canon?.[0].statement).toContain("不是女性");
  });

  it("assemble expand_character / outline / chapter inject lock + excerpt", () => {
    const p = renewProject();
    const chapter = {
      id: "c1",
      order: 1,
      title: "夜奔",
      summary: "流渊与清溪上路",
      keyPoints: "清溪",
      eroticNote: "",
      tags: [] as string[],
    };
    const outline = {
      premise: "旧稿焕新",
      endingNote: "未定",
      chapters: [chapter],
    };
    for (const task of ["expand_character", "outline", "chapter"] as const) {
      const payload = generateBody(p, task, {
        characters: p.characters,
        background: p.background,
        settings: p.settings,
        outline,
        chapter,
        projectTags: [],
        seed: "扩写清溪",
        character: p.characters[0],
      });
      const { user, system } = assemble(task, "general", payload);
      expect(system).toContain("原作焕新");
      expect(user).toContain(LOCKED_CANON_HEADING);
      expect(user).toContain("清溪");
      expect(user).toContain("白色战马");
      expect(user).toContain("不是人");
      expect(user).toContain("不是女性");
      expect(user).toContain(ORIGINAL_GROUNDING_HEADING);
      expect(user).toContain("踏雪无声");
    }
  });

  it("unlocked facts are omitted from the injected lock list", () => {
    const unlocked: LockedCanonFact = {
      ...QINGXI_LOCK,
      id: "u1",
      locked: false,
    };
    const block = buildOriginalGrounding({
      original: null,
      canon: [unlocked],
    });
    expect(block).toBe("");
    expect(formatLockedCanon([unlocked])).toBe("");
  });
});

describe("horse-not-person contradiction", () => {
  it("clearly injects 清溪 is a horse, not a woman", () => {
    const grounded = injectOriginalGrounding(
      { system: "SYS", user: "USER" },
      "expand_character",
      {
        original: {
          title: "醉词",
          sourceLabel: "粘贴导入",
          text: ZUI_CI_SNIPPET,
          updatedAt: "",
        } satisfies OriginalManuscript,
        canon: [QINGXI_LOCK],
        seed: "清溪",
        character: { name: "清溪" },
      }
    );
    expect(grounded.user).toContain("不是人");
    expect(grounded.user).toContain("不是女性");
    expect(grounded.system).toContain("必须遵守");
    expect(grounded.system).not.toContain("清溪");
  });

  it("detects generated woman-清溪 as a violation", () => {
    const woman = {
      name: "清溪",
      gender: "女",
      role: "女主",
      appearance: "温婉女子，长发如水",
    };
    const v = detectCharacterCanonViolations(woman, [QINGXI_LOCK]);
    expect(v.join("；")).toMatch(/不是人|不是女性|不能写成/);

    const prose = detectCanonViolations(
      "清溪是一位温婉的女子，她站在帐门口。",
      [QINGXI_LOCK]
    );
    expect(prose.length).toBeGreaterThan(0);

    const horse = {
      name: "清溪",
      gender: "",
      role: "坐骑",
      appearance: "通体雪白的战马，四蹄踏雪无声",
    };
    expect(detectCharacterCanonViolations(horse, [QINGXI_LOCK])).toEqual([]);
    expect(
      detectCanonViolations("清溪四蹄踏雪，载着流渊出帐。", [QINGXI_LOCK])
    ).toEqual([]);
    expect(
      detectCharacterCanonViolations(woman, [
        { ...QINGXI_LOCK, statement: "流渊的白色战马。" },
      ])
    ).toEqual([]);
  });

  it("does not flag unrelated characters", () => {
    const v = detectCharacterCanonViolations(
      { name: "流渊", gender: "男", role: "主角" },
      [QINGXI_LOCK]
    );
    expect(v).toEqual([]);
  });
});

describe("excerpts and persistence", () => {
  it("selectOriginalExcerpts prefers windows around 清溪 on long text", () => {
    const long = `${"甲".repeat(4000)}\n清溪踏雪而来\n${"乙".repeat(4000)}`;
    const excerpt = selectOriginalExcerpts(long, ["清溪"], 2000);
    expect(excerpt).toContain("清溪");
    expect(excerpt.length).toBeLessThan(long.length);
  });

  it("does not tokenize chapter summary sentences into excerpt keys", () => {
    const keys = excerptKeysFromPayload(
      {
        chapter: {
          title: "夜奔",
          summary: "他终于在渡口见到了那匹白马",
          keyPoints: "渡口相见",
        },
        characters: [{ name: "流渊", aliases: ["小渊"] }],
        loreEntries: [{ title: "霜桥", keys: ["霜桥", "北城门"] }],
      },
      [QINGXI_LOCK]
    );
    expect(keys).toEqual(
      expect.arrayContaining(["清溪", "流渊", "小渊", "霜桥", "北城门"])
    );
    expect(keys).not.toContain("他终于在渡口见到了那匹白马");
    expect(keys).not.toContain("渡口相见");
  });

  it("injectOriginalGrounding uses outline.chapters.length, not default 1", () => {
    const long = `${"甲".repeat(4000)}\n清溪在开头饮水\n${"乙".repeat(4000)}\n清溪在中段踏雪\n${"丙".repeat(4000)}\n清溪在末卷回望\n${"丁".repeat(2000)}`;
    const original = {
      title: "旧稿",
      sourceLabel: "粘贴导入",
      text: long,
      updatedAt: "",
    } satisfies OriginalManuscript;
    const chapter = {
      order: 2,
      title: "二",
      summary: "上路",
      keyPoints: "",
    };
    const missingOutline = injectOriginalGrounding(
      { system: "SYS", user: "USER" },
      "rewrite",
      { original, canon: [QINGXI_LOCK], chapter }
    );
    const withOutline = injectOriginalGrounding(
      { system: "SYS", user: "USER" },
      "rewrite",
      {
        original,
        canon: [QINGXI_LOCK],
        chapter,
        outline: { chapters: [{}, {}, {}, {}, {}] },
      }
    );
    expect(missingOutline.user).toContain("末卷回望");
    expect(withOutline.user).toContain("中段踏雪");
    expect(withOutline.user).not.toContain("末卷回望");
  });

  it("later chapters excerpt later original segments", () => {
    const long = `${"甲".repeat(4000)}\n清溪在开头饮水\n${"乙".repeat(4000)}\n清溪在中段踏雪\n${"丙".repeat(4000)}\n清溪在末卷回望\n${"丁".repeat(2000)}`;
    const late = selectOriginalExcerpts(long, ["清溪"], 2200, {
      chapterOrder: 5,
      chapterCount: 5,
    });
    expect(late).toContain("末卷回望");
    expect(late).not.toContain("在开头饮水");
  });

  it("original system rule decouples facts from prose", () => {
    expect(ORIGINAL_SYSTEM_RULE).toMatch(/情节|事实/);
    expect(ORIGINAL_SYSTEM_RULE).toMatch(/文笔|重写原句/);
    const grounded = injectOriginalGrounding(
      { system: "SYS", user: "USER" },
      "chapter",
      {
        original: {
          title: "旧稿",
          sourceLabel: "粘贴导入",
          text: ZUI_CI_SNIPPET,
          updatedAt: "",
        } satisfies OriginalManuscript,
        canon: [QINGXI_LOCK],
        chapter: { order: 1, title: "一", summary: "上路", keyPoints: "" },
        outline: { chapters: [{}, {}, {}, {}, {}] },
      }
    );
    expect(grounded.system).toMatch(/文笔|重写原句/);
    expect(grounded.user).toContain("文笔须按文风指南重写");
  });

  it("export/import JSON keeps original + locked canon", () => {
    const p = renewProject();
    const json = exportProjectJson(p);
    expect(json).toContain("清溪");
    expect(json).toContain("白色战马");
    const imported = importProjectJson(json);
    expect(imported.id).not.toBe(p.id);
    expect(imported.original?.title).toBe("醉词");
    expect(imported.original?.text).toContain("坐骑");
    expect(imported.canon?.[0].name).toBe("清溪");
    expect(imported.canon?.[0].locked).toBe(true);
    expect(imported.canon?.[0].statement).toContain("不是女性");
  });

  it("parseCanonFacts reads extract_canon JSON", () => {
    const facts = parseCanonFacts(`{
      "facts": [
        {
          "name": "清溪",
          "kind": "identity",
          "statement": "流渊的白色战马，不是人，不是女性",
          "aliases": []
        }
      ]
    }`);
    expect(facts).toHaveLength(1);
    expect(facts[0].name).toBe("清溪");
    expect(facts[0].locked).toBe(true);
    expect(facts[0].kind).toBe("identity");
  });
});
