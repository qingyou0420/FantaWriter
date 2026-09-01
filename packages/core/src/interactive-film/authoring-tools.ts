import type { StoryGraphDelta } from "./delta.js";
import type { WorldAnchor, Variable, Ending, StoryNode, Character } from "./graph-schema.js";

export function buildWorldAnchorDelta(patch: Partial<WorldAnchor>): StoryGraphDelta {
  return { worldAnchor: patch, notes: [] };
}

export function buildAddVariableDelta(v: Variable): StoryGraphDelta {
  return { variables: { upsert: [v], remove: [] }, notes: [] };
}

export function buildDefineEndingDelta(e: Ending): StoryGraphDelta {
  return { endings: { upsert: [e], remove: [] }, notes: [] };
}

export function buildRemoveNodeDelta(nodeId: string): StoryGraphDelta {
  return { nodes: { upsert: [], remove: [nodeId] }, notes: [] };
}

export function buildConnectChoiceDelta(node: StoryNode): StoryGraphDelta {
  return { nodes: { upsert: [node], remove: [] }, notes: [] };
}

export function buildUpsertCharactersDelta(chars: Character[]): StoryGraphDelta {
  return { characters: { upsert: chars, remove: [] }, notes: [] };
}
