import type { StoryGraph } from "./graph-schema.js";
import { visibleChoices, applyEffects, initVarState } from "./evaluator.js";
import type { VarState } from "./evaluator.js";

export interface RuntimePath {
  readonly nodeIds: readonly string[];
  readonly endingId: string | null;
  readonly length: number;
}

const DEFAULT_MAX_PATHS = 200;
const DEFAULT_MAX_DEPTH = 50;

function varStateKey(vars: VarState): string {
  return Object.keys(vars)
    .sort()
    .map((key) => `${key}:${JSON.stringify(vars[key])}`)
    .join("|");
}

export function enumerateRuntimePaths(
  graph: StoryGraph,
  opts?: { maxPaths?: number; maxDepth?: number },
): { paths: RuntimePath[]; truncated: boolean } {
  const maxPaths = opts?.maxPaths ?? DEFAULT_MAX_PATHS;
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const endingByNodeId = new Map(graph.endings.map((e) => [e.nodeId, e.id]));
  const start = graph.nodes.find((n) => n.type === "start");
  const paths: RuntimePath[] = [];
  let truncated = false;
  if (!start) return { paths, truncated };

  const walk = (nodeId: string, vars: VarState, trail: string[], onPath: Set<string>, depth: number): void => {
    if (paths.length >= maxPaths) { truncated = true; return; }
    if (depth > maxDepth) { truncated = true; return; }
    const visitKey = `${nodeId}\u0000${varStateKey(vars)}`;
    if (onPath.has(visitKey)) return; // No-op cycles are already represented by this exact node+state.
    const nextOnPath = new Set(onPath);
    nextOnPath.add(visitKey);
    const node = nodeById.get(nodeId);
    if (!node) return;
    const nextTrail = [...trail, nodeId];
    if (node.type === "ending") {
      paths.push({ nodeIds: nextTrail, endingId: endingByNodeId.get(nodeId) ?? null, length: nextTrail.length });
      return;
    }
    const choices = visibleChoices(node, vars);
    if (choices.length === 0) {
      // dead-end leaf (no ending): record as a terminal path with null ending
      paths.push({ nodeIds: nextTrail, endingId: null, length: nextTrail.length });
      return;
    }
    for (const choice of choices) {
      if (paths.length >= maxPaths) { truncated = true; return; }
      const nextVars = applyEffects(vars, choice.effects);
      walk(choice.targetNodeId, nextVars, nextTrail, nextOnPath, depth + 1);
    }
  };

  walk(start.id, initVarState(graph.variables), [], new Set(), 0);
  return { paths, truncated };
}
