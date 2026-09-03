import { describe, expect, it } from "vitest";
import { MAX_VOLUME_TREE_LABEL_CHARS, parseVolumeMapTree } from "./volume-map-tree";
import {
  outlineTreeHeadingTooLong,
  outlineTreeVolumeLabel,
  outlineWeavePrompt,
  resolveOutlineWeaveMode,
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
  it("rebuilds a full tree when no chapter entries exist", () => {
    expect(resolveOutlineWeaveMode(0)).toBe("full");
    expect(resolveOutlineWeaveMode(12)).toBe("remaining");
    expect(outlineWeavePrompt(true, "full")).toContain("确认闸");
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
});
