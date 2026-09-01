import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStoryGraph, saveStoryGraph, storyGraphPath } from "../interactive-film/graph-store.js";
import { StoryGraphSchema } from "../interactive-film/graph-schema.js";

const sample = StoryGraphSchema.parse({
  schemaVersion: 1, projectId: "demo", title: "Demo", variables: [],
  nodes: [
    { id: "s", type: "start", choices: [{ id: "c", text: "go", targetNodeId: "e" }] },
    { id: "e", type: "ending", choices: [] },
  ],
  endings: [{ id: "x", nodeId: "e", title: "end", type: "good" }],
});

describe("graph-store", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "if-store-")); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("returns null when the graph file does not exist", async () => {
    expect(await loadStoryGraph(root, "demo")).toBeNull();
  });

  it("round-trips a graph through save and load", async () => {
    await saveStoryGraph(root, "demo", sample);
    const loaded = await loadStoryGraph(root, "demo");
    expect(loaded).toEqual(sample);
  });

  it("computes the expected path", () => {
    expect(storyGraphPath(root, "demo")).toBe(join(root, "interactive-films", "demo", "story-graph.json"));
  });
});
