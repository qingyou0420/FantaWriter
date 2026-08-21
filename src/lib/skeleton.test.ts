import { describe, expect, it } from "vitest";
import { assemble } from "./prompts/registry";
import {
  SKELETON_UNKNOWN,
  isNonPersonEntity,
  mapSkeletonToProject,
  parseStorySkeleton,
  type StorySkeleton,
} from "./skeleton";
import { createEmptyProject } from "./types";

const SAMPLE_JSON = `{
  "origin": "北城门破后，行人甲带着铜铃南下。",
  "mainLine": "行人甲要在霜桥交还信物",
  "subLines": ["旧城守军找铜铃"],
  "foreshadows": ["霜桥第三块石缺了一角"],
  "darkLines": ["铜铃里藏着旧城令"],
  "characters": [
    {
      "name": "行人甲",
      "role": "主角",
      "relationships": "带着铜铃",
      "notes": "原文称行人甲",
      "entityKind": "person",
      "statement": "南下的旅人",
      "aliases": []
    },
    {
      "name": "霜桥",
      "role": "${SKELETON_UNKNOWN}",
      "relationships": "${SKELETON_UNKNOWN}",
      "notes": "北城外石桥",
      "entityKind": "place",
      "statement": "北城外石桥，地点而非角色",
      "aliases": []
    },
    {
      "name": "青辔",
      "role": "${SKELETON_UNKNOWN}",
      "relationships": "${SKELETON_UNKNOWN}",
      "notes": "坐骑",
      "entityKind": "mount",
      "statement": "行人甲的坐骑，不是人",
      "aliases": []
    }
  ],
  "relationships": "行人甲带着铜铃走霜桥",
  "timeline": "城破次日黎明",
  "world": "北城刚易主",
  "items": [
    { "name": "铜铃", "statement": "旧城信物，物品而非角色", "aliases": [] }
  ],
  "volumes": [{ "title": "上卷", "summary": "离城" }],
  "chapters": [
    {
      "order": 1,
      "title": "霜桥",
      "summary": "行人甲走到霜桥",
      "keyPoints": "交铃",
      "volumeTitle": "上卷",
      "castNames": ["行人甲"],
      "beats": [
        {
          "order": 1,
          "title": "上桥",
          "summary": "黎明上桥",
          "verbatimAnchors": ["霜桥第三块石缺了一角"]
        }
      ]
    }
  ],
  "unknowns": ["铜铃为何要在霜桥交还"]
}`;

describe("parseStorySkeleton", () => {
  it("keeps evidenced fields and marks blanks as 待补充", () => {
    const sk = parseStorySkeleton(SAMPLE_JSON);
    expect(sk.origin).toContain("北城门破");
    expect(sk.mainLine).toContain("霜桥");
    expect(sk.darkLines[0]).toContain("旧城令");
    expect(sk.chapters[0].beats[0].verbatimAnchors).toContain(
      "霜桥第三块石缺了一角"
    );
    expect(sk.unknowns).toContain("铜铃为何要在霜桥交还");
  });

  it("does not invent missing sections", () => {
    const sk = parseStorySkeleton(`{"origin":"","mainLine":"","characters":[]}`);
    expect(sk.origin).toBe(SKELETON_UNKNOWN);
    expect(sk.mainLine).toBe(SKELETON_UNKNOWN);
    expect(sk.world).toBe(SKELETON_UNKNOWN);
    expect(sk.chapters).toEqual([]);
    expect(sk.unknowns.length).toBeGreaterThan(0);
  });
});

describe("isNonPersonEntity", () => {
  it("treats place/mount/item statements as non-characters", () => {
    expect(
      isNonPersonEntity({
        name: "霜桥",
        entityKind: "place",
        statement: "北城外石桥，地点而非角色",
      })
    ).toBe(true);
    expect(
      isNonPersonEntity({
        name: "青辔",
        statement: "行人甲的坐骑，不是人",
      })
    ).toBe(true);
    expect(
      isNonPersonEntity({
        name: "行人甲",
        entityKind: "person",
        statement: "南下的旅人",
      })
    ).toBe(false);
  });
});

describe("mapSkeletonToProject", () => {
  it("maps into existing fields and never makes places/items/mounts into Character rows", () => {
    const project = createEmptyProject("焕新样例");
    project.characters = [];
    const skeleton = parseStorySkeleton(SAMPLE_JSON);
    const next = mapSkeletonToProject(project, skeleton);

    const names = next.characters.map((c) => c.name);
    expect(names).toContain("行人甲");
    expect(names).not.toContain("霜桥");
    expect(names).not.toContain("青辔");
    expect(names).not.toContain("铜铃");

    const loreTitles = (next.lore || []).map((e) => e.title);
    expect(loreTitles).toContain("霜桥");
    expect(loreTitles).toContain("青辔");
    expect(loreTitles).toContain("铜铃");
    expect(loreTitles).toContain("世界观");
    expect(loreTitles).toContain("时间线");
    expect(next.lore?.find((e) => e.title === "铜铃")?.category).toBe("item");
    expect(next.lore?.find((e) => e.title === "霜桥")?.category).toBe("place");

    const canonNames = (next.canon || []).map((f) => f.name);
    expect(canonNames).toContain("铜铃");
    expect(canonNames).toContain("霜桥");
    expect(next.canon?.find((f) => f.name === "铜铃")?.kind).toBe("item");
    expect(next.canon?.find((f) => f.name === "铜铃")?.statement).toContain(
      "物品"
    );

    expect(next.outline?.premise).toContain("北城门破");
    expect(next.outline?.chapters[0].title).toBe("霜桥");
    expect(next.chapters[0].scenes?.[0].title).toBe("上桥");
    expect(next.chapters[0].scenes?.[0].verbatimAnchors).toContain(
      "霜桥第三块石缺了一角"
    );
    expect(next.chapters[0].content).toBe("");

    const dark = next.plotThreads?.find((t) => t.kind === "dark");
    expect(dark?.title).toContain("旧城令");
    expect(dark?.visibility).toBe("author_only");
    expect(next.plotThreads?.find((t) => t.kind === "main")?.visibility).toBe(
      "reader_known"
    );
    expect(next.volumes?.some((v) => v.title === "上卷")).toBe(true);
  });

  it("merges canon instead of replacing the whole table", () => {
    const project = createEmptyProject("合并");
    project.characters = [];
    project.canon = [
      {
        id: "keep",
        name: "旧锁",
        kind: "fact",
        statement: "已由作者锁定的事实",
        locked: true,
      },
    ];
    const skeleton: StorySkeleton = {
      ...parseStorySkeleton(SAMPLE_JSON),
    };
    const next = mapSkeletonToProject(project, skeleton);
    expect(next.canon?.some((f) => f.id === "keep")).toBe(true);
    expect(next.canon?.some((f) => f.name === "铜铃")).toBe(true);
  });

  it("does not overwrite already written chapter content", () => {
    const project = createEmptyProject("已有正文");
    const chId = "ch-keep";
    project.outline = {
      premise: "旧前提",
      endingNote: "",
      chapters: [
        {
          id: chId,
          order: 1,
          title: "旧题",
          summary: "旧摘要",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    project.chapters = [
      {
        chapterId: chId,
        title: "旧题",
        content: "已经写下的正文不会被骨架抹掉。",
        status: "done",
        updatedAt: "",
        scenes: [
          { id: "s1", order: 1, title: "旧拍", summary: "旧", status: "accepted" },
        ],
      },
    ];
    const next = mapSkeletonToProject(project, parseStorySkeleton(SAMPLE_JSON));
    const row = next.chapters.find((c) => c.chapterId === chId);
    expect(row?.content).toContain("已经写下");
    expect(row?.scenes?.[0].title).toBe("旧拍");
  });
});

describe("extract_skeleton prompt", () => {
  it("only asks for evidenced facts and requires place/object identity", () => {
    const { user } = assemble("extract_skeleton", "general", {
      sampleText: "北城门破。行人甲带着铜铃走上霜桥。",
      titleHint: "旧稿",
    });
    expect(user).toContain("只写原文已经写明");
    expect(user).toContain(SKELETON_UNKNOWN);
    expect(user).toContain("禁止脑补");
    expect(user).toContain("地点、器物、坐骑");
    expect(user).toContain("statement 必须写明原文身份");
    expect(user).not.toMatch(/清溪|白马/);
  });
});
