import { describe, expect, it } from "vitest";
import {
  MAX_VOLUME_TREE_LABEL_CHARS,
  formatVolumeLabel,
  listedExactChapterNumbers,
  missingExactChapters,
  nextUnfilledChapterBatch,
  resolveOutlineWeaveStep,
  parseProseVolumeHints,
  parseVolumeMapTree,
  planVolumeRanges,
  planVolumeRangesFromHints,
  renderVolumeMapMarkdown,
  resolveTargetChapterCount,
  volumeMapHasReviewableTree,
} from "../utils/volume-map-tree.js";
import { findVolumeMapEntry } from "../utils/volume-map-entry.js";

/** Local 《醉词》 volume_map shape: H2s are section labels, not volumes. */
export const ZUI_CI_PROSE_FIXTURE = [
  "## 各卷主题与情绪曲线",
  "共七卷：冕旒(40) 棋枰(40) 白羽(45) 商陆(40) 醉生(35) 江山(35) 清溪(25)。第一卷压，中卷放，末卷压回。",
  "卷一埋：开篇在酒楼听曲，把旧案残页和醉词令混进宾客闲话里，让读者以为只是风月场的气氛铺垫，其实每一句唱词都在点后宅账本的缺口，后宅账本的缺口又指向令牌、典当行和县衙夜审，这一行必须长到旧解析器会把它整段当成卷标题。",
  "卷一Objective：本卷结束时主角必须在酒楼站稳眼线并拿到醉词令残页，同时让典当行承认空账，还要在县衙夜审上逼出第二证人，并且把冕旒一卷的前台冲突、关系变化和不可逆揭示全部写进这一行，旧解析器会把整段当成 1339 字标题。",
  "卷一末：酒楼眼线暴露，旧案残页被当众点破，体面撕开之后没有回头路，这一行同样长到会变成墙标题。",
  "## 卷间钩子与回收承诺",
  "第一卷埋下醉词令，中卷回收典当行空账。",
  "## 各卷OKR",
  "卷一先站稳酒楼眼线，卷二把旧案推到不可收回，卷三公开对质。",
  "KR1 = 拿到醉词令残页",
  "KR2 = 让典当行承认那笔空账",
  "KR3 = 在县衙夜审上逼出第二证人",
  "## 卷尾必须发生的改变",
  "第一卷末：身份暴露。",
  "## 节奏原则",
  "前 10 章高压引人。",
  "## 第 1 章",
  "",
].join("\n");

describe("parseVolumeMapTree — heading contract", () => {
  it("parses a reviewable 卷→章 tree", () => {
    const markdown = renderVolumeMapMarkdown([
      {
        volumeNumber: 1,
        title: "试炼",
        startChapter: 1,
        endChapter: 3,
        body: "Objective：从杂役转入正式弟子籍。\nKR1 = 拿到药园执事",
        chapters: [
          { chapterNumber: 1, title: "入局", summary: "主角走进档案室。" },
          { chapterNumber: 2, title: "夜谈", summary: "在廊下听见旧案。" },
          { chapterNumber: 3, title: "残页", summary: "发现半页案卷。" },
        ],
      },
    ]);
    const tree = parseVolumeMapTree(markdown);
    expect(tree.volumeCount).toBe(1);
    expect(tree.chapterCount).toBe(3);
    expect(tree.volumes[0]?.title.length).toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
    expect(tree.volumes[0]?.title).toContain("试炼");
    expect(tree.volumes[0]?.body).toContain("Objective");
    expect(listedExactChapterNumbers(tree)).toEqual([1, 2, 3]);
  });

  it("does not treat 醉词-style prose as a wall-of-text volume title", () => {
    const tree = parseVolumeMapTree(ZUI_CI_PROSE_FIXTURE);
    expect(tree.volumeCount).toBe(0);
    expect(tree.volumes).toHaveLength(0);
    // The empty `## 第 1 章` stub is a real chapter entry; parser does not invent more.
    expect(tree.chapterCount).toBe(1);
    expect(tree.orphanChapters[0]?.title).toBe("");
    expect(formatVolumeLabel(1, ZUI_CI_PROSE_FIXTURE.split("\n").find((line) => line.startsWith("卷一埋"))!, true).length)
      .toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
  });

  it("does not promote the old 卷N VOLUME_HEADER prose lines or section H2s", () => {
    const oldVolumeHeader = /^\s*卷\s*[一二三四五六七八九十百\d]+/;
    const fakeTitles = [
      ZUI_CI_PROSE_FIXTURE.split("\n").find((line) => line.startsWith("卷一埋"))!,
      ZUI_CI_PROSE_FIXTURE.split("\n").find((line) => line.startsWith("卷一Objective"))!,
      ZUI_CI_PROSE_FIXTURE.split("\n").find((line) => line.startsWith("卷一末"))!,
    ];
    expect(fakeTitles.every((line) => oldVolumeHeader.test(line))).toBe(true);
    const tree = parseVolumeMapTree(ZUI_CI_PROSE_FIXTURE);
    expect(tree.volumes).toHaveLength(0);
    for (const heading of ["各卷主题与情绪曲线", "卷间钩子与回收承诺", "各卷OKR", "卷尾必须发生的改变", "节奏原则"]) {
      expect(tree.volumes.some((volume) => volume.title.includes(heading))).toBe(false);
    }
    const hints = parseProseVolumeHints(ZUI_CI_PROSE_FIXTURE);
    expect(hints.map((hint) => `${hint.title}(${hint.chapterCount})`)).toEqual([
      "冕旒(40)",
      "棋枰(40)",
      "白羽(45)",
      "商陆(40)",
      "醉生(35)",
      "江山(35)",
      "清溪(25)",
    ]);
    expect(hints.reduce((sum, hint) => sum + hint.chapterCount, 0)).toBe(260);
    const ranges = planVolumeRangesFromHints(hints, 260);
    expect(ranges).toHaveLength(7);
    expect(ranges?.[0]).toMatchObject({ title: "冕旒", startChapter: 1, endChapter: 40 });
    expect(ranges?.[6]).toMatchObject({ title: "清溪", startChapter: 236, endChapter: 260 });
  });

  it("keeps a heading-only 第N卷 title short even if a writer stuffed junk after the marker", () => {
    const tree = parseVolumeMapTree("## 第1卷 试炼：卷一埋很长的OKR和KR1不要进标题（1-4章）\nObjective：开局。\n");
    expect(tree.volumeCount).toBe(1);
    expect(tree.volumes[0]?.title.length).toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
    expect(tree.volumes[0]?.title).not.toMatch(/KR1|埋很长/);
    expect(formatVolumeLabel(tree.volumes[0]!.volumeNumber, tree.volumes[0]!.title, true).length)
      .toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
  });

  it("does not invent chapter entries from volume prose", () => {
    const tree = parseVolumeMapTree("## 第1卷 试炼（1-4章）\nObjective：开局。\n");
    expect(tree.chapterCount).toBe(0);
    expect(findVolumeMapEntry("## 第1卷 试炼（1-4章）\nObjective：开局。\n", 1)).toBeUndefined();
  });
});

describe("planVolumeRanges", () => {
  it("splits 90 chapters across multiple volumes", () => {
    const ranges = planVolumeRanges(90);
    expect(ranges.length).toBeGreaterThan(1);
    expect(ranges[0]?.startChapter).toBe(1);
    expect(ranges.at(-1)?.endChapter).toBe(90);
    expect(ranges.reduce((sum, range) => sum + (range.endChapter - range.startChapter + 1), 0)).toBe(90);
  });

  it("does not dump 200 chapters into one volume", () => {
    expect(planVolumeRanges(200).length).toBeGreaterThan(3);
  });

  it("resolves chapter count from total words when targetChapters is missing", () => {
    expect(resolveTargetChapterCount({ totalWords: 270_000, chapterWordCount: 3000 })).toBe(90);
    expect(resolveTargetChapterCount({ targetChapters: 90, totalWords: 10 })).toBe(90);
  });
});

describe("renderVolumeMapMarkdown", () => {
  it("emits a 90-chapter tree the outline parser can review", () => {
    const ranges = planVolumeRanges(90);
    const volumes = ranges.map((range) => ({
      ...range,
      title: `弧${range.volumeNumber}`,
      body: `Objective：第${range.volumeNumber}卷推进。`,
      chapters: Array.from({ length: range.endChapter - range.startChapter + 1 }, (_, index) => ({
        chapterNumber: range.startChapter + index,
        title: `节点${range.startChapter + index}`,
        summary: `推进到节点${range.startChapter + index}。`,
      })),
    }));
    const markdown = renderVolumeMapMarkdown(volumes);
    const tree = parseVolumeMapTree(markdown);
    expect(tree.volumeCount).toBeGreaterThan(1);
    expect(listedExactChapterNumbers(tree)).toHaveLength(90);
    expect(volumeMapHasReviewableTree(tree, 90)).toBe(true);
    for (const volume of tree.volumes) {
      expect(volume.title.length).toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
      expect(volume.title).not.toMatch(/OKR|KR1|埋线/);
    }
  });

  it("emits headings parseVolumeMapTree can read as N volumes and targetChapters chapters", () => {
    const ranges = planVolumeRanges(12);
    const volumes = ranges.map((range) => ({
      ...range,
      title: `弧${range.volumeNumber}`,
      body: `Objective：第${range.volumeNumber}卷推进。`,
      chapters: Array.from({ length: range.endChapter - range.startChapter + 1 }, (_, index) => ({
        chapterNumber: range.startChapter + index,
        title: `节点${range.startChapter + index}`,
        summary: `推进到节点${range.startChapter + index}。`,
      })),
    }));
    const markdown = renderVolumeMapMarkdown(volumes);
    const tree = parseVolumeMapTree(markdown);
    expect(volumeMapHasReviewableTree(tree, 12)).toBe(true);
    expect(missingExactChapters(tree, 12)).toEqual([]);
    expect(findVolumeMapEntry(markdown, 1)).toBeTruthy();
  });

  it("resumes 醉词-style books as volume-lock then 10-chapter batches", () => {
    expect(resolveOutlineWeaveStep(parseVolumeMapTree(ZUI_CI_PROSE_FIXTURE), 260, ZUI_CI_PROSE_FIXTURE)).toBe("volumes");
    const locked = renderVolumeMapMarkdown([{
      volumeNumber: 1,
      title: "冕旒",
      startChapter: 1,
      endChapter: 40,
      body: "Objective：开局。",
      chapters: [{ chapterNumber: 1, title: "入局", summary: "走进酒楼。" }],
    }]);
    const tree = parseVolumeMapTree(locked);
    expect(resolveOutlineWeaveStep(tree, 40, locked)).toBe("batch");
    expect(nextUnfilledChapterBatch(tree, 40, 10)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
