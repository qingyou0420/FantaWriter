import { describe, expect, it } from "vitest";
import {
  MAX_VOLUME_TREE_LABEL_CHARS,
  formatVolumeLabel,
  listedExactChapterNumbers,
  missingExactChapters,
  nextUnfilledChapterBatch,
  resolveOutlineWeaveStep,
  parseProseVolumeHints,
  isPlaceholderVolumeTitle,
  volumeMapHasLockedNamedVolumes,
  parseVolumeMapTree,
  planVolumeRanges,
  planVolumeRangesFromHints,
  renderVolumeMapMarkdown,
  resolveTargetChapterCount,
  volumeMapHasReviewableTree,
} from "../utils/volume-map-tree.js";
import { findVolumeMapEntry } from "../utils/volume-map-entry.js";

/** Real 《醉词》 leftover: 卷一《冕旒》 plus Chinese counts, not 冕旒(40). */
export const ZUI_CI_VOLUME_NOTES = [
  "## 各卷主题与情绪曲线",
  "共七卷：卷一《冕旒》、卷二《棋枰》、卷三《白羽》、卷四《商陆》、卷五《醉生》、卷六《江山》、卷七《清溪》。各卷四十、四十、四十五、四十、三十五、三十五、二十五章。第一卷压，中卷放，末卷压回。",
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
].join("\n");

/** Local 《醉词》 volume_map shape: H2s are section labels, not volumes. */
export const ZUI_CI_PROSE_FIXTURE = `${ZUI_CI_VOLUME_NOTES}\n## 第 1 章\n`;

/** What 2.0.7 actually wrote: even-split 第N程 plus leftover notes under 原架构笔记. */
export const ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE = [
  "## 第1卷 第1程（1-38章）",
  "原架构笔记：",
  ZUI_CI_VOLUME_NOTES,
  "",
  "## 第2卷 第2程（39-75章）",
  "Objective：本卷结束时主角必须达成可验证的阶段状态。\nKR1：前台冲突推进\nKR2：关系或势力变化\nKR3：一次不可逆揭示",
  "",
  "## 第3卷 第3程（76-112章）",
  "Objective：本卷结束时主角必须达成可验证的阶段状态。",
  "",
  "## 第4卷 第4程（113-149章）",
  "Objective：本卷结束时主角必须达成可验证的阶段状态。",
  "",
  "## 第5卷 第5程（150-186章）",
  "Objective：本卷结束时主角必须达成可验证的阶段状态。",
  "",
  "## 第6卷 第6程（187-223章）",
  "Objective：本卷结束时主角必须达成可验证的阶段状态。",
  "",
  "## 第7卷 第7程（224-260章）",
  "Objective：本卷结束时主角必须达成可验证的阶段状态。",
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

  it("still recovers 冕旒(40) parenthetical hints", () => {
    const hints = parseProseVolumeHints("共七卷：冕旒(40) 棋枰(40) 白羽(45) 商陆(40) 醉生(35) 江山(35) 清溪(25)。");
    expect(hints.map((hint) => hint.title)).toEqual(["冕旒", "棋枰", "白羽", "商陆", "醉生", "江山", "清溪"]);
    expect(hints.reduce((sum, hint) => sum + hint.chapterCount, 0)).toBe(260);
  });

  it("pairs 卷一《冕旒》四十章 adjacent counts", () => {
    const hints = parseProseVolumeHints("卷一《冕旒》四十章，卷二《棋枰》四十章，卷三《白羽》四十五章。");
    expect(hints).toEqual([
      { title: "冕旒", chapterCount: 40 },
      { title: "棋枰", chapterCount: 40 },
      { title: "白羽", chapterCount: 45 },
    ]);
  });

  it("re-reads leftover 原架构笔记 after a 第N程 even-split lock", () => {
    const tree = parseVolumeMapTree(ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE);
    expect(tree.volumeCount).toBe(7);
    expect(tree.volumes.map((volume) => volume.title)).toEqual(
      expect.arrayContaining(["第1卷 第1程", "第7卷 第7程"]),
    );
    expect(tree.volumes.every((volume) => isPlaceholderVolumeTitle(volume.title))).toBe(true);
    expect(volumeMapHasLockedNamedVolumes(tree)).toBe(false);
    expect(resolveOutlineWeaveStep(tree, 260, ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE)).toBe("volumes");
    const hints = parseProseVolumeHints(ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE);
    expect(hints.map((hint) => `${hint.title}(${hint.chapterCount})`)).toEqual([
      "冕旒(40)",
      "棋枰(40)",
      "白羽(45)",
      "商陆(40)",
      "醉生(35)",
      "江山(35)",
      "清溪(25)",
    ]);
    expect(planVolumeRanges(260)[0]).toMatchObject({ startChapter: 1, endChapter: 38 });
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
    expect(resolveOutlineWeaveStep(
      parseVolumeMapTree(ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE),
      260,
      ZUI_CI_PLACEHOLDER_LOCKED_FIXTURE,
    )).toBe("volumes");
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
