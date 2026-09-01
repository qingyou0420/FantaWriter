import { describe, expect, it } from "vitest";
import { emotionScore, nodeEmotion, analyzeEmotionalArcs, analyzePathDistribution } from "../interactive-film/emotion.js";
import { StoryNodeSchema, StoryGraphSchema, type StoryGraph } from "../interactive-film/graph-schema.js";

describe("emotion analysis", () => {
  it("emotionScore: positive vs negative vs unknown", () => {
    expect(emotionScore("喜悦")).toBeGreaterThan(0);
    expect(emotionScore("悲伤")).toBeLessThan(0);
    expect(emotionScore("zzz未知词")).toBe(0);
  });
  it("emotionScore: negation prefix flips valence (Fix 3)", () => {
    // "不高兴" used to partial-match "高兴" (+0.8) without negation guard → false positive
    expect(emotionScore("不高兴")).toBeLessThanOrEqual(0);
    // Sanity: plain "高兴" still positive
    expect(emotionScore("高兴")).toBeGreaterThan(0);
    // Other negation prefixes
    expect(emotionScore("没高兴")).toBeLessThanOrEqual(0);
    expect(emotionScore("未高兴")).toBeLessThanOrEqual(0);
  });
  it("nodeEmotion averages dialogue emotions", () => {
    const node = StoryNodeSchema.parse({ id: "n", type: "branch", dialogue: [{ speaker: "a", text: "x", emotion: "喜悦" }, { speaker: "b", text: "y", emotion: "悲伤" }], choices: [] });
    expect(typeof nodeEmotion(node)).toBe("number"); // avg of +/- ≈ near 0
  });
  it("analyzeEmotionalArcs returns a point series per path", () => {
    const graph: StoryGraph = StoryGraphSchema.parse({
      schemaVersion: 1, projectId: "p", title: "T", variables: [],
      nodes: [
        { id: "s", type: "start", dialogue: [{ speaker: "a", text: "x", emotion: "希望" }], choices: [{ id: "c", text: "go", targetNodeId: "e" }] },
        { id: "e", type: "ending", dialogue: [{ speaker: "a", text: "y", emotion: "喜悦" }], choices: [] },
      ],
      endings: [{ id: "g1", nodeId: "e", title: "好", type: "good" }],
    });
    const { arcs } = analyzeEmotionalArcs(graph);
    expect(arcs.length).toBe(1);
    expect(arcs[0].points.map((p) => p.nodeId)).toEqual(["s", "e"]);
  });
  it("analyzePathDistribution counts paths by ending + length", () => {
    const graph: StoryGraph = StoryGraphSchema.parse({
      schemaVersion: 1, projectId: "p", title: "T", variables: [],
      nodes: [
        { id: "s", type: "start", choices: [{ id: "a", text: "A", targetNodeId: "e1" }, { id: "b", text: "B", targetNodeId: "e2" }] },
        { id: "e1", type: "ending", choices: [] }, { id: "e2", type: "ending", choices: [] },
      ],
      endings: [{ id: "g1", nodeId: "e1", title: "好", type: "good" }, { id: "b1", nodeId: "e2", title: "坏", type: "bad" }],
    });
    const d = analyzePathDistribution(graph);
    expect(d.total).toBe(2);
    expect(d.byEnding.g1).toBe(1);
    expect(d.byEnding.b1).toBe(1);
  });
});
