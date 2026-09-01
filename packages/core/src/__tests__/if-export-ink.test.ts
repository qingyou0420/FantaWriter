import { describe, expect, it } from "vitest";
import { exportInk } from "../interactive-film/export-ink.js";
import { StoryGraphSchema } from "../interactive-film/graph-schema.js";

const graph = StoryGraphSchema.parse({
  schemaVersion: 1, projectId: "p", title: "T",
  variables: [{ name: "trust", type: "counter", default: 0, desc: "" }],
  nodes: [
    { id: "s", type: "start", title: "开场", sceneDesc: "宫门前", dialogue: [{ speaker: "阿梅", text: "查账", emotion: "坚定" }],
      choices: [
        { id: "a", text: "公开", targetNodeId: "e1", effects: [{ var: "trust", op: "add", value: 1 }] },
        { id: "b", text: "需信任", targetNodeId: "e2", condition: { var: "trust", op: ">=", value: 1 } },
      ] },
    { id: "e1", type: "ending", title: "真相", choices: [] },
    { id: "e2", type: "ending", title: "黯然", choices: [] },
  ],
  endings: [{ id: "g1", nodeId: "e1", title: "真相", type: "good" }, { id: "b1", nodeId: "e2", title: "黯然", type: "bad" }],
});

describe("exportInk", () => {
  it("declares variables", () => { expect(exportInk(graph)).toContain("VAR trust = 0"); });
  it("emits a knot per node", () => { const ink = exportInk(graph); expect(ink).toContain("=== node_s ==="); expect(ink).toContain("=== node_e1 ==="); });
  it("maps a choice with a divert", () => { expect(exportInk(graph)).toMatch(/\*\s*\[公开\][\s\S]*?->\s*node_e1/); });
  it("emits a choice's effect before its divert (so it actually applies)", () => {
    const ink = exportInk(graph);
    const eff = ink.indexOf("~ trust += 1");
    const div = ink.indexOf("-> node_e1");
    expect(eff).toBeGreaterThan(-1);
    expect(div).toBeGreaterThan(-1);
    expect(eff).toBeLessThan(div);
  });
  it("maps a conditional choice", () => { expect(exportInk(graph)).toMatch(/\{\s*trust\s*>=\s*1\s*\}/); });
  it("maps an effect", () => { expect(exportInk(graph)).toMatch(/~\s*trust\s*\+=\s*1/); });
  it("ends ending knots with -> END", () => { const ink = exportInk(graph); const e1 = ink.slice(ink.indexOf("=== node_e1 ===")); expect(e1).toContain("-> END"); });
});
