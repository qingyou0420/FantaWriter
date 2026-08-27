import { describe, expect, it } from "vitest";
import {
  authorOnlyThreads,
  buildBeatContract,
  formatBeatContract,
  applyBeatDeltasToProject,
  incomingCanonDeltas,
  mergeBeatChapterSummary,
  missingVerbatimAnchors,
  proposeBeatDeltas,
  readerKnownThreads,
  upsertTimelineLore,
} from "./beat-contract";
import { buildMemoryPack } from "./memory-pack";
import { createEmptyPlotThread, createEmptyProject, type LockedCanonFact } from "./types";

function thread(
  title: string,
  extra: Partial<ReturnType<typeof createEmptyPlotThread>> = {}
) {
  return { ...createEmptyPlotThread(title), ...extra };
}

describe("dark-thread filter", () => {
  it("keeps author_only / dark threads out of memory pack", () => {
    const p = createEmptyProject("暗线");
    p.plotThreads = [
      thread("读者已知的渡口约", {
        visibility: "reader_known",
        kind: "foreshadow",
        status: "active",
      }),
      thread("铜铃里藏着旧城令", {
        visibility: "author_only",
        kind: "dark",
        status: "planted",
      }),
    ];
    p.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "上路",
          keyPoints: "",
          tags: [],
        },
        {
          id: "c2",
          order: 2,
          title: "二",
          summary: "上桥",
          keyPoints: "",
          tags: [],
        },
      ],
    };
    p.chapters = [
      {
        chapterId: "c1",
        title: "一",
        content: "正文",
        status: "done",
        updatedAt: "",
        summary: "离开北城。",
      },
    ];

    expect(readerKnownThreads(p.plotThreads).map((t) => t.title)).toEqual([
      "读者已知的渡口约",
    ]);
    expect(authorOnlyThreads(p.plotThreads).map((t) => t.title)).toEqual([
      "铜铃里藏着旧城令",
    ]);

    const pack = buildMemoryPack(p, 2);
    expect(pack.plotThreads).toContain("读者已知的渡口约");
    expect(pack.plotThreads).not.toContain("旧城令");
    expect(pack.priorBlock).toContain("读者已知的渡口约");
    expect(pack.priorBlock).not.toContain("旧城令");
  });
});

describe("beat contract", () => {
  it("reuses forbiddenClaimsFromStatement and lists dark threads as must-not-leak", () => {
    const canon: LockedCanonFact[] = [
      {
        id: "1",
        name: "霜桥",
        kind: "place",
        statement: "北城外石桥，不是人，不是角色",
        locked: true,
      },
    ];
    const threads = [
      thread("交还铜铃", { visibility: "reader_known", kind: "main", id: "t1" }),
      thread("铜铃里藏着旧城令", {
        visibility: "author_only",
        kind: "dark",
        id: "t2",
      }),
    ];
    const contract = buildBeatContract({
      canon,
      threads,
      scene: {
        threadIds: ["t1"],
        verbatimAnchors: ["霜桥第三块石缺了一角"],
      },
    });
    expect(contract.mustKeepLocks[0]).toContain("霜桥");
    expect(contract.forbiddenClaims.some((c) => c.includes("不是人"))).toBe(true);
    expect(contract.advanceThreadIds).toEqual(["t1"]);
    expect(contract.darkThreadIds).toEqual(["t2"]);
    expect(contract.verbatimAnchors).toEqual(["霜桥第三块石缺了一角"]);

    const block = formatBeatContract(contract, threads);
    expect(block).toContain("本拍契约");
    expect(block).toContain("禁止写成");
    expect(block).toContain("暗线（仅作者可见，正文不得提前泄漏）");
    expect(block).toContain("原句锚点");
  });

  it("proposeBeatDeltas does not invent items or overwrite canon", () => {
    const threads = [
      thread("交还铜铃", { visibility: "reader_known", id: "t1" }),
      thread("铜铃里藏着旧城令", { visibility: "author_only", id: "t2" }),
    ];
    const deltas = proposeBeatDeltas({
      draft: "行人甲在霜桥交还铜铃。",
      scene: { summary: "上桥", threadIds: ["t1"] },
      threads,
    });
    expect(deltas.touchedThreadIds).toEqual(["t1"]);
    expect(deltas.itemProposals).toEqual([]);
    expect(deltas.canonProposals).toEqual([]);
  });

  it("incomingCanonDeltas skips locked names instead of replacing the table", () => {
    const existing: LockedCanonFact[] = [
      {
        id: "keep",
        name: "霜桥",
        kind: "place",
        statement: "北城外石桥，地点而非角色",
        locked: true,
      },
    ];
    const incoming: LockedCanonFact[] = [
      {
        id: "new",
        name: "霜桥",
        kind: "place",
        statement: "模型想整条覆盖",
        locked: true,
      },
      {
        id: "add",
        name: "铜铃",
        kind: "item",
        statement: "旧城信物，物品而非角色",
        locked: true,
      },
    ];
    const deltas = incomingCanonDeltas(existing, incoming);
    expect(deltas.map((f) => f.name)).toEqual(["铜铃"]);
  });

  it("missingVerbatimAnchors reports rewritten anchors", () => {
    expect(
      missingVerbatimAnchors("霜桥很旧。", ["霜桥第三块石缺了一角"])
    ).toEqual(["霜桥第三块石缺了一角"]);
    expect(
      missingVerbatimAnchors("霜桥第三块石缺了一角。", [
        "霜桥第三块石缺了一角",
      ])
    ).toEqual([]);
  });

  it("accumulates multi-beat summaries and creates the timeline lore entry", () => {
    expect(mergeBeatChapterSummary(undefined, 1, "上桥")).toBe("【拍1】上桥");
    expect(mergeBeatChapterSummary("【拍1】上桥", 2, "交铃")).toBe(
      "【拍1】上桥\n【拍2】交铃"
    );
    const created = upsertTimelineLore([], "寅时出城");
    expect(created[0].title).toBe("时间线");
    expect(created[0].body).toContain("寅时出城");
    const appended = upsertTimelineLore(created, "卯时过桥");
    expect(appended[0].body).toContain("寅时出城");
    expect(appended[0].body).toContain("卯时过桥");

    const applied = applyBeatDeltasToProject({
      chapters: [
        {
          chapterId: "c1",
          title: "一",
          content: "正文",
          status: "done",
          updatedAt: "",
          summary: "【拍1】上桥",
        },
      ],
      lore: [],
      threads: [],
      chapterId: "c1",
      deltas: {
        summary: "交铃",
        timelineNote: "卯时过桥",
        touchedThreadIds: [],
        itemProposals: [],
        canonProposals: [],
      },
      scene: { order: 2, summary: "交铃" },
    });
    expect(applied.chapters[0].summary).toContain("【拍1】上桥");
    expect(applied.chapters[0].summary).toContain("【拍2】交铃");
    expect(applied.lore.some((e) => e.title === "时间线")).toBe(true);
  });
});
