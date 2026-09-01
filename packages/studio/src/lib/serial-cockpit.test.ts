import { describe, expect, it } from "vitest";
import {
  assembleCockpitSnapshot,
  resolveWriteThisChapterAction,
  writeDisableReasonCodes,
  type CockpitAssemblyInput,
  type CockpitPreflight,
} from "./serial-cockpit";
import {
  applyVolumeMapNodeEdit,
  findChapterNode,
  insertChapterStub,
  parseVolumeMapTree,
  recommendedOutlineNodeId,
} from "./volume-map-tree";

const blockedPreflight = (chapterNumber: number, codes: string[]): CockpitPreflight => ({
  ok: false,
  chapterNumber,
  reasons: codes.map((code) => ({
    code,
    message: `${code} for ${chapterNumber}`,
    messageZh: `${code}：第 ${chapterNumber} 章`,
    jumpTo: code === "previous_chapter_not_approved" ? "review" : "outline",
    chapterNumber,
  })),
});

const readyPreflight = (chapterNumber: number): CockpitPreflight => ({
  ok: true,
  chapterNumber,
  reasons: [],
});

function baseInput(overrides: Partial<CockpitAssemblyInput> = {}): CockpitAssemblyInput {
  return {
    chapters: [
      { number: 1, title: "入局", status: "approved", wordCount: 2100 },
    ],
    nextChapter: 2,
    volumeMap: [
      "## 第一卷《试炼》（1-4章）",
      "Objective：从杂役转入正式弟子籍。",
      "KR1 = 拿到药园执事",
      "",
      "## 第 1 章 入局",
      "主角走进档案室。",
      "## 第 2 章 夜谈",
      "在廊下听见旧案。",
      "## 第 3 章 残页",
      "发现半页案卷。",
    ].join("\n"),
    preflight: readyPreflight(2),
    dueHooks: [],
    reviewQueue: [],
    pendingProposals: [],
    isZh: true,
    ...overrides,
  };
}

describe("parseVolumeMapTree", () => {
  it("parses volume headers, chapter lines, and OKR prose", () => {
    const tree = parseVolumeMapTree(baseInput().volumeMap);
    expect(tree.volumeCount).toBe(1);
    expect(tree.chapterCount).toBe(3);
    expect(tree.volumes[0]?.title).toContain("第一卷");
    expect(tree.volumes[0]?.startChapter).toBe(1);
    expect(tree.volumes[0]?.endChapter).toBe(4);
    expect(tree.volumes[0]?.okr).toContain("Objective");
    expect(findChapterNode(tree, 2)?.title).toBe("夜谈");
    expect(findChapterNode(tree, 2)?.summary).toContain("廊下");
  });

  it("keeps range nodes without inventing missing exact chapters", () => {
    const tree = parseVolumeMapTree("- Chapter 2-4: harbor arc\n");
    expect(tree.orphanChapters[0]?.kind).toBe("range");
    expect(findChapterNode(tree, 3)?.id).toBe("range:2-4");
    expect(findChapterNode(tree, 5)).toBeUndefined();
  });
});

describe("assembleCockpitSnapshot", () => {
  it("assembles next chapter number, title, volume position, and one-line", () => {
    const snapshot = assembleCockpitSnapshot(baseInput());
    expect(snapshot.nextChapter.number).toBe(2);
    expect(snapshot.nextChapter.title).toBe("夜谈");
    expect(snapshot.nextChapter.volumePosition).toContain("第一卷");
    expect(snapshot.nextChapter.volumePosition).toMatch(/2\/4|第 2\/4/);
    expect(snapshot.nextChapter.oneLine).toContain("廊下");
    expect(snapshot.volume?.okr).toContain("正式弟子籍");
    expect(snapshot.volume?.written).toBe(1);
    expect(snapshot.volume?.planned).toBe(4);
    expect(snapshot.writeNext.enabled).toBe(true);
    expect(snapshot.volumeClose).toBeNull();
  });

  it("surfaces overdue hooks separately from due hooks", () => {
    const snapshot = assembleCockpitSnapshot(baseInput({
      dueHooks: [
        { hookId: "身世残页", dueState: "due", targetChapter: 2 },
        { hookId: "药园钥匙", dueState: "overdue", targetChapter: 1 },
      ],
    }));
    expect(snapshot.dueHooks).toHaveLength(2);
    expect(snapshot.overdueHooks.map((hook) => hook.hookId)).toEqual(["药园钥匙"]);
  });

  it("disables 落墨 with G1 reasons and marks outline jump", () => {
    const snapshot = assembleCockpitSnapshot(baseInput({
      volumeMap: "## 第一卷\nObjective：开局。\n",
      preflight: blockedPreflight(2, ["missing_volume_map_entry", "empty_author_intent"]),
    }));
    expect(snapshot.writeNext.enabled).toBe(false);
    expect(writeDisableReasonCodes(snapshot)).toEqual([
      "missing_volume_map_entry",
      "empty_author_intent",
    ]);
    expect(snapshot.writeNext.jumpToOutline).toBe(true);
    expect(snapshot.nextChapter.title).toBeNull();
  });

  it("exposes last-chapter status and critical review shortcut when blocked", () => {
    const snapshot = assembleCockpitSnapshot(baseInput({
      chapters: [
        { number: 1, title: "入局", status: "audit-failed", wordCount: 1800 },
      ],
      nextChapter: 2,
      preflight: blockedPreflight(2, ["previous_chapter_not_approved"]),
      reviewQueue: [
        { chapterNumber: 1, severity: "critical", category: "ooc", description: "人设崩了" },
        { chapterNumber: 1, severity: "warning", category: "pacing", description: "开篇慢" },
      ],
    }));
    expect(snapshot.lastChapter).toEqual({
      number: 1,
      title: "入局",
      status: "audit-failed",
      blocked: true,
    });
    expect(snapshot.criticalReview).toEqual({ chapterNumber: 1, count: 1 });
    expect(snapshot.writeNext.enabled).toBe(false);
    expect(writeDisableReasonCodes(snapshot)).toContain("previous_chapter_not_approved");
  });

  it("counts pending truth-diff proposals only", () => {
    const snapshot = assembleCockpitSnapshot(baseInput({
      pendingProposals: [
        { id: "a", fileName: "outline/volume_map.md", status: "pending" },
        { id: "b", fileName: "book_rules.md", status: "applied" },
        { id: "c", fileName: "author_intent.md" },
      ],
    }));
    expect(snapshot.pendingProposalCount).toBe(2);
  });

  it("offers volume close only when the volume is finished and next volume is absent", () => {
    const closed = assembleCockpitSnapshot(baseInput({
      chapters: [
        { number: 1, title: "一", status: "approved" },
        { number: 2, title: "二", status: "approved" },
        { number: 3, title: "三", status: "approved" },
        { number: 4, title: "四", status: "approved" },
      ],
      nextChapter: 5,
      volumeMap: [
        "## 第一卷（1-4章）",
        "Objective：入门。",
        "## 第 1 章",
        "## 第 2 章",
        "## 第 3 章",
        "## 第 4 章",
      ].join("\n"),
      preflight: readyPreflight(5),
    }));
    expect(closed.volumeClose?.volumeName).toContain("第一卷");

    const alreadyHasNext = assembleCockpitSnapshot(baseInput({
      chapters: [
        { number: 1, title: "一", status: "approved" },
        { number: 2, title: "二", status: "approved" },
        { number: 3, title: "三", status: "approved" },
        { number: 4, title: "四", status: "approved" },
      ],
      nextChapter: 5,
      volumeMap: [
        "## 第一卷（1-4章）",
        "Objective：入门。",
        "## 第 4 章 收束",
        "## 第二卷（5-8章）",
        "Objective：下山。",
        "## 第 5 章 启程",
      ].join("\n"),
      preflight: readyPreflight(5),
    }));
    expect(alreadyHasNext.volumeClose).toBeNull();
  });
});

describe("resolveWriteThisChapterAction", () => {
  it("writes the selected next chapter only when G1 passes", () => {
    expect(resolveWriteThisChapterAction({
      selectedChapter: 3,
      nextChapter: 3,
      written: false,
      preflight: readyPreflight(3),
    })).toMatchObject({ kind: "write", enabled: true, chapterNumber: 3 });

    const blocked = resolveWriteThisChapterAction({
      selectedChapter: 3,
      nextChapter: 3,
      written: false,
      preflight: blockedPreflight(3, ["missing_volume_map_entry"]),
    });
    expect(blocked.enabled).toBe(false);
    expect(blocked.reasons.map((reason) => reason.code)).toEqual(["missing_volume_map_entry"]);
  });

  it("does not let a later selected node skip the next chapter", () => {
    const action = resolveWriteThisChapterAction({
      selectedChapter: 5,
      nextChapter: 3,
      written: false,
      preflight: readyPreflight(3),
    });
    expect(action.kind).toBe("disabled");
    expect(action.enabled).toBe(false);
    expect(action.reasons[0]?.code).toBe("not_next_chapter");
  });

  it("turns a written selected node into 查看正文", () => {
    expect(resolveWriteThisChapterAction({
      selectedChapter: 1,
      nextChapter: 3,
      written: true,
      preflight: readyPreflight(3),
    })).toMatchObject({ kind: "view", enabled: true, chapterNumber: 1 });
  });
});

describe("outline in-place edit", () => {
  it("edits a chapter title and summary without adding a second AI entry", () => {
    const next = applyVolumeMapNodeEdit(baseInput().volumeMap, "chapter:2", {
      title: "夜谈改",
      summary: "改过的一行。",
    });
    const tree = parseVolumeMapTree(next);
    expect(findChapterNode(tree, 2)?.title).toBe("夜谈改");
    expect(findChapterNode(tree, 2)?.summary).toBe("改过的一行。");
    expect(findChapterNode(tree, 1)?.title).toBe("入局");
  });

  it("inserts a chapter stub and recommends the next unwritten chapter", () => {
    const withStub = insertChapterStub("## 第一卷\nObjective：开局。\n", 1);
    const tree = parseVolumeMapTree(withStub);
    expect(findChapterNode(tree, 1)?.id).toBe("chapter:1");
    expect(recommendedOutlineNodeId(tree, 1)).toBe("chapter:1");
  });
});
