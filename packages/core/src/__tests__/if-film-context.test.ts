import { describe, expect, it } from "vitest";
import { summarizeStoryGraph, buildFilmAuthoringContext } from "../interactive-film/film-context.js";
import { StoryGraphSchema, type StoryGraph } from "../interactive-film/graph-schema.js";

const graph: StoryGraph = StoryGraphSchema.parse({
  schemaVersion: 1, projectId: "p", title: "宫斗账本",
  worldAnchor: { storyCore: "查账复仇", theme: "信任", genre: "宫斗", worldRules: "无魔法", durationMinutes: 30 },
  characters: [{ id: "mei", name: "阿梅", role: "protagonist", motivation: "查账", voiceProfile: { speakingRhythm: "短促", vocabulary: "市井", sampleLines: [] } }],
  variables: [{ name: "trust", type: "counter", default: 0, desc: "" }],
  nodes: [
    { id: "s", type: "start", title: "开场", choices: [{ id: "c", text: "去查", targetNodeId: "e" }] },
    { id: "e", type: "ending", title: "真相", choices: [] },
  ],
  endings: [{ id: "g", nodeId: "e", title: "真相大白", type: "good", description: "" }],
});

describe("film-context", () => {
  it("summary mentions title, a node with its choice target, and variables", () => {
    const s = summarizeStoryGraph(graph);
    expect(s).toContain("宫斗账本");
    expect(s).toContain("s");
    expect(s).toContain("e");      // choice target
    expect(s).toContain("trust");
  });
  it("authoring context includes character voice line", () => {
    const ctx = buildFilmAuthoringContext(graph);
    expect(ctx).toContain("阿梅");
    expect(ctx).toContain("短促");
  });
});
