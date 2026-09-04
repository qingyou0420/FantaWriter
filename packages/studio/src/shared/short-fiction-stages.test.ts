import { describe, expect, it } from "vitest";
import {
  advanceShortFictionStages,
  currentShortFictionStage,
  normalizeToolStartStages,
  shortFictionToolStages,
} from "./short-fiction-stages";

describe("shortFictionToolStages", () => {
  it("uses a compact Chinese list and marks the first step active", () => {
    const stages = shortFictionToolStages("outline", 12, "zh");
    expect(stages.map((stage) => stage.label)).toEqual(["创建大纲", "审大纲", "改大纲"]);
    expect(stages[0]?.status).toBe("active");
    expect(stages.slice(1).every((stage) => stage.status === "pending")).toBe(true);
  });

  it("keeps write as one updating slot instead of one row per chapter", () => {
    const stages = shortFictionToolStages("draft", 14, "zh");
    expect(stages.map((stage) => stage.label)).toEqual(["写章", "审稿", "修订", "封面"]);
  });

  it("includes outline then draft for a full run", () => {
    expect(shortFictionToolStages("full", 12, "zh").map((stage) => stage.label)).toEqual([
      "创建大纲", "审大纲", "改大纲", "写章", "审稿", "修订", "封面",
    ]);
  });
});

describe("advanceShortFictionStages", () => {
  it("walks outline → review → revise and then locks", () => {
    let stages = shortFictionToolStages("outline", 12, "zh");
    stages = advanceShortFictionStages(stages, "正在撰写短篇大纲…")!;
    expect(currentShortFictionStage(stages)?.label).toBe("创建大纲");
    stages = advanceShortFictionStages(stages, "正在审阅大纲…")!;
    expect(stages.map((stage) => stage.status)).toEqual(["completed", "active", "pending"]);
    stages = advanceShortFictionStages(stages, "正在修订大纲…")!;
    expect(currentShortFictionStage(stages)?.label).toBe("改大纲");
    stages = advanceShortFictionStages(stages, "大纲已锁定，等待作者确认后再写章。")!;
    expect(stages.every((stage) => stage.status === "completed")).toBe(true);
  });

  it("updates the write slot to 写第 N 章 as chapters advance", () => {
    let stages = shortFictionToolStages("draft", 12, "zh");
    stages = advanceShortFictionStages(stages, "正在撰写第3章（3/12）…")!;
    expect(currentShortFictionStage(stages)).toMatchObject({ label: "写第 3 章", status: "active" });
    stages = advanceShortFictionStages(stages, "第3章已写完（3/12）")!;
    expect(currentShortFictionStage(stages)?.label).toBe("写第 3 章");
    stages = advanceShortFictionStages(stages, "正在撰写第12章（12/12）…")!;
    expect(currentShortFictionStage(stages)?.label).toBe("写第 12 章");
    stages = advanceShortFictionStages(stages, "第12章已写完（12/12）")!;
    expect(stages[0]).toMatchObject({ label: "写第 12 章", status: "completed" });
    stages = advanceShortFictionStages(stages, "正在审阅全文…")!;
    expect(currentShortFictionStage(stages)?.label).toBe("审稿");
    stages = advanceShortFictionStages(stages, "正在修订全文…")!;
    expect(currentShortFictionStage(stages)?.label).toBe("修订");
    stages = advanceShortFictionStages(stages, "正在生成简介与封面提示词…")!;
    expect(currentShortFictionStage(stages)?.label).toBe("封面");
  });
});

describe("normalizeToolStartStages", () => {
  it("accepts both label lists and status objects", () => {
    expect(normalizeToolStartStages(["创建大纲", "审大纲"], "short_fiction_run")).toEqual([
      { label: "创建大纲", status: "active" },
      { label: "审大纲", status: "pending" },
    ]);
    expect(normalizeToolStartStages(
      [{ label: "写第 2 章", status: "active" }, { label: "审稿", status: "pending" }],
      "short_fiction_run",
    )).toEqual([
      { label: "写第 2 章", status: "active" },
      { label: "审稿", status: "pending" },
    ]);
  });
});
