import { describe, expect, it } from "vitest";
import { StoryNodeSchema, StoryGraphSchema } from "../interactive-film/graph-schema.js";

describe("StoryNode.position (additive)", () => {
  it("parses a node without position (backward compatible)", () => {
    const n = StoryNodeSchema.parse({ id: "s", type: "start", choices: [] });
    expect(n.position).toBeUndefined();
  });
  it("parses a node with position", () => {
    const n = StoryNodeSchema.parse({ id: "s", type: "start", choices: [], position: { x: 120, y: 40 } });
    expect(n.position).toEqual({ x: 120, y: 40 });
  });
  it("a full graph round-trips position", () => {
    const g = StoryGraphSchema.parse({
      schemaVersion: 1, projectId: "p", title: "T", variables: [],
      nodes: [{ id: "s", type: "start", choices: [], position: { x: 10, y: 20 } }],
      endings: [],
    });
    expect(g.nodes[0].position).toEqual({ x: 10, y: 20 });
  });
});
