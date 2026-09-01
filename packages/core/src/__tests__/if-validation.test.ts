import { describe, expect, it } from "vitest";
import { validateStoryGraph } from "../interactive-film/validation.js";
import { StoryGraphSchema, type StoryGraph } from "../interactive-film/graph-schema.js";

function graph(nodes: unknown[], endings: unknown[] = []): StoryGraph {
  return StoryGraphSchema.parse({
    schemaVersion: 1, projectId: "t", title: "t", variables: [], nodes, endings,
  });
}

describe("validateStoryGraph", () => {
  it("passes a valid start->ending graph", () => {
    const g = graph([
      { id: "s", type: "start", choices: [{ id: "c", text: "go", targetNodeId: "e" }] },
      { id: "e", type: "ending", choices: [] },
    ], [{ id: "x", nodeId: "e", title: "end", type: "good" }]);
    const r = validateStoryGraph(g);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("flags DEAD_END for a non-ending node with no exit", () => {
    const g = graph([
      { id: "s", type: "start", choices: [{ id: "c", text: "go", targetNodeId: "m" }] },
      { id: "m", type: "normal", choices: [] },
    ]);
    const codes = validateStoryGraph(g).issues.map((i) => i.code);
    expect(codes).toContain("DEAD_END");
  });

  it("flags BROKEN_LINK for a choice to a missing node", () => {
    const g = graph([
      { id: "s", type: "start", choices: [{ id: "c", text: "go", targetNodeId: "ghost" }] },
      { id: "e", type: "ending", choices: [] },
    ]);
    const codes = validateStoryGraph(g).issues.map((i) => i.code);
    expect(codes).toContain("BROKEN_LINK");
    expect(validateStoryGraph(g).ok).toBe(false);
  });

  it("flags UNREACHABLE (warning) for an island node", () => {
    const g = graph([
      { id: "s", type: "start", choices: [{ id: "c", text: "go", targetNodeId: "e" }] },
      { id: "e", type: "ending", choices: [] },
      { id: "island", type: "ending", choices: [] },
    ]);
    const issue = validateStoryGraph(g).issues.find((i) => i.code === "UNREACHABLE");
    expect(issue?.nodeIds).toEqual(["island"]);
    expect(issue?.level).toBe("warning");
  });

  it("flags NO_PATH_TO_ENDING when start cannot reach an ending", () => {
    const g = graph([
      { id: "s", type: "start", choices: [{ id: "c", text: "loop", targetNodeId: "s" }] },
    ]);
    const codes = validateStoryGraph(g).issues.map((i) => i.code);
    expect(codes).toContain("NO_PATH_TO_ENDING");
  });
});
