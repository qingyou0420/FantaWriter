import type { Condition, Effect, StoryNode, Choice, Variable, VarValue } from "./graph-schema.js";

export type VarState = Record<string, VarValue>;

export function evaluateCondition(condition: Condition | undefined, vars: VarState): boolean {
  if (!condition) return true;
  const lhs = vars[condition.var];
  const rhs = condition.value;
  switch (condition.op) {
    case "==": return lhs === rhs;
    case "!=": return lhs !== rhs;
    case ">=": return Number(lhs) >= Number(rhs);
    case "<=": return Number(lhs) <= Number(rhs);
    case ">":  return Number(lhs) > Number(rhs);
    case "<":  return Number(lhs) < Number(rhs);
  }
}

export function applyEffects(vars: VarState, effects: readonly Effect[] | undefined): VarState {
  if (!effects || effects.length === 0) return vars;
  const next: VarState = { ...vars };
  for (const e of effects) {
    if (e.op === "set") {
      next[e.var] = e.value;
    } else {
      const cur = Number(next[e.var] ?? 0);
      const delta = Number(e.value);
      next[e.var] = e.op === "add" ? cur + delta : cur - delta;
    }
  }
  return next;
}

export function visibleChoices(node: StoryNode, vars: VarState): Choice[] {
  return node.choices.filter((c) => evaluateCondition(c.condition, vars));
}

export function initVarState(variables: readonly Variable[]): VarState {
  const state: VarState = {};
  for (const v of variables) state[v.name] = v.default;
  return state;
}
