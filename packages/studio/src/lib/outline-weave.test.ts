import { describe, expect, it } from "vitest";
import { MAX_VOLUME_TREE_LABEL_CHARS, parseVolumeMapTree } from "./volume-map-tree";
import {
  applyOutlineWeaveSseEvent,
  formatOutlineWeaveProgress,
  outlineTreeHeadingTooLong,
  outlineTreeVolumeLabel,
  outlineWeaveButtonLabel,
  outlineWeavePrompt,
  readOutlineWeaveErrorBody,
  resolveOutlineWeaveAction,
} from "./outline-weave";

const ZUI_CI_PROSE = [
  "## 各卷主题与情绪曲线",
  "卷一埋：开篇在酒楼听曲，把旧案残页和醉词令混进宾客闲话里，让读者以为只是风月场的气氛铺垫。",
  "卷一Objective：本卷结束时主角必须在酒楼站稳眼线并拿到残页，旧解析器会把整段当成标题。",
  "## 各卷OKR",
  "KR1 = 拿到醉词令残页",
  "## 第 1 章",
].join("\n");

describe("outline weave helpers", () => {
  it("re-locks 第N程 headings when leftover notes still have 冕旒 names", () => {
    const markdown = [
      "## 第1卷 第1程（1-38章）",
      "原架构笔记：",
      "共七卷：卷一《冕旒》、卷二《棋枰》、卷三《白羽》、卷四《商陆》、卷五《醉生》、卷六《江山》、卷七《清溪》。各卷四十、四十、四十五、四十、三十五、三十五、二十五章。",
      "## 第2卷 第2程（39-75章）",
      "Objective：开局。",
    ].join("\n");
    const action = resolveOutlineWeaveAction(parseVolumeMapTree(markdown), 260, markdown);
    expect(action.step).toBe("volumes");
    expect(action.mode).toBe("volumes");
    expect(outlineWeaveButtonLabel(action, true)).toBe("织卷 · 锁定卷纲");
  });

  it("locks volumes first when the tree has no 卷 ranges", () => {
    const tree = parseVolumeMapTree(ZUI_CI_PROSE);
    const action = resolveOutlineWeaveAction(tree, 260, ZUI_CI_PROSE);
    expect(action.step).toBe("volumes");
    expect(action.mode).toBe("volumes");
    expect(outlineWeaveButtonLabel(action, true)).toBe("织卷 · 锁定卷纲");
    expect(outlineWeavePrompt(true, "volumes")).toContain("确认闸");
  });

  it("offers the next 10 chapters after volumes are locked", () => {
    const markdown = "## 第1卷 冕旒（1-40章）\nObjective：开局。\n## 第 1 章 入局\n走进酒楼。\n";
    const tree = parseVolumeMapTree(markdown);
    const action = resolveOutlineWeaveAction(tree, 40, markdown);
    expect(action.step).toBe("batch");
    expect(action.mode).toBe("batch");
    expect(action.chapterStart).toBe(2);
    expect(action.chapterEnd).toBe(11);
    expect(outlineWeaveButtonLabel(action, true)).toContain("第2–11章");
  });

  it("does not render 醉词 prose as a wall-of-text tree heading", () => {
    const tree = parseVolumeMapTree(ZUI_CI_PROSE);
    expect(tree.volumeCount).toBe(0);
    const buried = ZUI_CI_PROSE.split("\n").find((line) => line.startsWith("卷一埋"))!;
    const label = outlineTreeVolumeLabel(1, buried, true);
    expect(label.length).toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
    expect(outlineTreeHeadingTooLong(label)).toBe(false);
    expect(label).not.toContain("KR1");
    expect(label).not.toContain("酒楼");
  });

  it("keeps a real volume heading short in the tree", () => {
    const tree = parseVolumeMapTree("## 第1卷 试炼（1-30章）\nObjective：开局。\n## 第 1 章 入局\n走进酒楼。\n");
    const volume = tree.volumes[0];
    expect(volume).toBeDefined();
    const label = outlineTreeVolumeLabel(volume!.volumeNumber, volume!.title, true);
    expect(label.length).toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
    expect(label).toContain("试炼");
  });

  it("shows weaving progress for the in-flight 10-chapter batch", () => {
    const text = formatOutlineWeaveProgress({
      phase: "chunk",
      talkingToModel: true,
      volumeNumber: 1,
      volumeCount: 7,
      volumeTitle: "冕旒",
      chapterStart: 1,
      chapterEnd: 10,
      elapsedMs: 5000,
      message: "第1卷 冕旒 第1–10章 · 正在请求模型",
    }, true);
    expect(text).toContain("第1卷 冕旒 第1–10章");
    expect(text).toContain("正在请求模型");
    expect(text).toContain("5s");
  });

  it("applies weave SSE events for the current book", () => {
    const startedAt = Date.now() - 2000;
    const next = applyOutlineWeaveSseEvent("醉词", "weave:progress", {
      bookId: "醉词",
      talkingToModel: true,
      volumeNumber: 1,
      volumeTitle: "冕旒",
      chapterStart: 1,
      chapterEnd: 10,
      message: "第1卷 冕旒 第1–10章 · 正在请求模型",
    }, startedAt);
    expect(next?.chapterStart).toBe(1);
    expect(next?.chapterEnd).toBe(10);
    expect(next?.talkingToModel).toBe(true);
    expect(applyOutlineWeaveSseEvent("醉词", "weave:progress", { bookId: "other" }, startedAt)).toBeNull();
  });

  it("reads a weave 500 so the UI can alert and keep a partial proposal", () => {
    const parsed = readOutlineWeaveErrorBody({
      error: "织卷失败：第1卷 第1–10章 — LLM stream produced no token for 60000ms",
      proposal: { id: "p1", fileName: "outline/volume_map.md", unifiedDiff: "---\n+++" },
    });
    expect(parsed.message).toContain("第1–10章");
    expect(parsed.proposal?.id).toBe("p1");
  });
});
