import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  applyEffects,
  visibleChoices,
  initVarState,
  type VarState,
} from "../interactive-film/evaluator.js";
import type { StoryNode } from "../interactive-film/graph-schema.js";

describe("evaluateCondition", () => {
  const vars: VarState = { trust: 2, flag: true, name: "mei" };
  it("returns true when condition is undefined", () => {
    expect(evaluateCondition(undefined, vars)).toBe(true);
  });
  it("compares numbers with >=, <, >", () => {
    expect(evaluateCondition({ var: "trust", op: ">=", value: 2 }, vars)).toBe(true);
    expect(evaluateCondition({ var: "trust", op: "<", value: 2 }, vars)).toBe(false);
    expect(evaluateCondition({ var: "trust", op: ">", value: 1 }, vars)).toBe(true);
  });
  it("compares equality for booleans and strings", () => {
    expect(evaluateCondition({ var: "flag", op: "==", value: true }, vars)).toBe(true);
    expect(evaluateCondition({ var: "name", op: "!=", value: "mei" }, vars)).toBe(false);
  });
});

describe("applyEffects", () => {
  it("does not mutate the input and applies set/add/sub", () => {
    const vars: VarState = { trust: 1 };
    const next = applyEffects(vars, [
      { var: "trust", op: "add", value: 2 },
      { var: "guard", op: "set", value: 5 },
      { var: "trust", op: "sub", value: 1 },
    ]);
    expect(vars).toEqual({ trust: 1 }); // unchanged
    expect(next).toEqual({ trust: 2, guard: 5 });
  });
  it("returns the same reference when no effects", () => {
    const vars: VarState = { a: 1 };
    expect(applyEffects(vars, [])).toBe(vars);
    expect(applyEffects(vars, undefined)).toBe(vars);
  });
});

describe("visibleChoices", () => {
  const node: StoryNode = {
    id: "n1", title: "", type: "branch", sceneDesc: "", dialogue: [], act: "",
    choices: [
      { id: "a", text: "always", targetNodeId: "x", effects: [] },
      { id: "b", text: "gated", targetNodeId: "y", effects: [], condition: { var: "trust", op: ">=", value: 3 } },
    ],
  };
  it("filters out choices whose condition fails", () => {
    expect(visibleChoices(node, { trust: 1 }).map((c) => c.id)).toEqual(["a"]);
    expect(visibleChoices(node, { trust: 3 }).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("initVarState", () => {
  it("seeds defaults from variables", () => {
    expect(initVarState([
      { name: "trust", type: "counter", default: 0, desc: "" },
      { name: "won", type: "flag", default: false, desc: "" },
    ])).toEqual({ trust: 0, won: false });
  });
});
