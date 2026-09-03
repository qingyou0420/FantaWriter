import { describe, expect, it } from "vitest";
import {
  MAX_VOLUME_TREE_LABEL_CHARS,
  formatVolumeLabel,
  listedExactChapterNumbers,
  missingExactChapters,
  parseVolumeMapTree,
  planVolumeRanges,
  renderVolumeMapMarkdown,
  resolveTargetChapterCount,
  volumeMapHasReviewableTree,
} from "../utils/volume-map-tree.js";
import { findVolumeMapEntry } from "../utils/volume-map-entry.js";

export const ZUI_CI_PROSE_FIXTURE = [
  "卷一埋：开篇在酒楼听曲，把旧案残页和醉词令混进宾客闲话里，让读者以为只是风月场的气氛铺垫，其实每一句唱词都在点后宅账本的缺口。",
  "卷二埋：中卷把令牌、典当行和县衙夜审拧成一条线，OKR 还没拆开就先把对手的体面撕开。",
  "各卷OKR：卷一先站稳酒楼眼线，卷二把旧案推到不可收回，卷三公开对质。",
  "KR1 = 拿到醉词令残页",
  "KR2 = 让典当行承认那笔空账",
  "KR3 = 在县衙夜审上逼出第二证人",
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
    expect(tree.chapterCount).toBe(0);
    for (const volume of tree.volumes) {
      expect(formatVolumeLabel(volume.volumeNumber, volume.title, true).length)
        .toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
      expect(volume.title).not.toContain("KR1");
      expect(volume.title).not.toContain("各卷OKR");
    }
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
});
