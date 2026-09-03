import { describe, expect, it } from "vitest";
import { MAX_VOLUME_TREE_LABEL_CHARS, parseVolumeMapTree } from "./volume-map-tree";
import {
  outlineTreeHeadingTooLong,
  outlineTreeVolumeLabel,
  outlineWeavePrompt,
  resolveOutlineWeaveMode,
} from "./outline-weave";

const ZUI_CI_PROSE = [
  "卷一埋：开篇在酒楼听曲，把旧案残页和醉词令混进宾客闲话里。",
  "卷二埋：中卷把令牌、典当行和县衙夜审拧成一条线。",
  "各卷OKR：卷一先站稳酒楼眼线，卷二把旧案推到不可收回。",
  "KR1 = 拿到醉词令残页",
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
    const label = outlineTreeVolumeLabel(1, ZUI_CI_PROSE.split("\n")[0]!, true);
    expect(label.length).toBeLessThanOrEqual(MAX_VOLUME_TREE_LABEL_CHARS);
    expect(outlineTreeHeadingTooLong(label)).toBe(false);
    expect(label).not.toContain("KR1");
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
