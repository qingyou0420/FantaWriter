import type { StoryGraph, StoryNode } from "./graph-schema.js";
import { enumerateRuntimePaths } from "./paths.js";

// Initial lexicon (extendable). Maps common Chinese emotion words to a valence in [-1,1].
const EMOTION_LEXICON: Record<string, number> = {
  "喜悦": 0.9, "高兴": 0.8, "快乐": 0.8, "希望": 0.6, "坚定": 0.5, "温暖": 0.6, "感动": 0.6, "释然": 0.4, "平静": 0.0, "中性": 0.0,
  "紧张": -0.4, "焦虑": -0.5, "愤怒": -0.6, "恐惧": -0.7, "悲伤": -0.8, "绝望": -0.95, "痛苦": -0.8, "失落": -0.5, "犹豫": -0.2, "冷漠": -0.3,
};

export function emotionScore(word: string): number {
  const w = word.trim();
  if (!w) return 0;
  if (w in EMOTION_LEXICON) return EMOTION_LEXICON[w];
  // partial match: if any lexicon key is contained in the word (e.g. "很悲伤")
  // Negation guard: if the character immediately before the matched key is a negation character
  // (不/没/无/别/未), flip the valence so "不高兴" scores negative rather than positive.
  for (const key of Object.keys(EMOTION_LEXICON)) {
    if (w.includes(key)) {
      const keyIdx = w.indexOf(key);
      const charBefore = keyIdx > 0 ? w[keyIdx - 1] : "";
      if ("不没无别未".includes(charBefore)) return -EMOTION_LEXICON[key];
      return EMOTION_LEXICON[key];
    }
  }
  return 0;
}

export function nodeEmotion(node: StoryNode): number {
  const lines = node.dialogue ?? [];
  if (lines.length === 0) return 0;
  const sum = lines.reduce((acc, l) => acc + emotionScore(l.emotion), 0);
  return sum / lines.length;
}

export function analyzeEmotionalArcs(graph: StoryGraph): {
  arcs: { endingId: string | null; points: { nodeId: string; score: number }[] }[];
  truncated: boolean;
} {
  const { paths, truncated } = enumerateRuntimePaths(graph);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const arcs = paths.map((p) => ({
    endingId: p.endingId,
    points: p.nodeIds.map((id) => {
      const node = nodeById.get(id);
      return { nodeId: id, score: node ? nodeEmotion(node) : 0 };
    }),
  }));
  return { arcs, truncated };
}

export function analyzePathDistribution(graph: StoryGraph): {
  total: number;
  truncated: boolean;
  byEnding: Record<string, number>;
  lengthHistogram: Record<number, number>;
} {
  const { paths, truncated } = enumerateRuntimePaths(graph);
  const byEnding: Record<string, number> = {};
  const lengthHistogram: Record<number, number> = {};
  for (const p of paths) {
    const key = p.endingId ?? "(dead-end)";
    byEnding[key] = (byEnding[key] ?? 0) + 1;
    lengthHistogram[p.length] = (lengthHistogram[p.length] ?? 0) + 1;
  }
  return { total: paths.length, truncated, byEnding, lengthHistogram };
}
