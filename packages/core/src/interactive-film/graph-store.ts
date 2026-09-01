import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { StoryGraphSchema, type StoryGraph } from "./graph-schema.js";

export function storyGraphPath(projectRoot: string, projectId: string): string {
  return join(projectRoot, "interactive-films", projectId, "story-graph.json");
}

export async function loadStoryGraph(
  projectRoot: string,
  projectId: string,
): Promise<StoryGraph | null> {
  try {
    const raw = await readFile(storyGraphPath(projectRoot, projectId), "utf-8");
    return StoryGraphSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveStoryGraph(
  projectRoot: string,
  projectId: string,
  graph: StoryGraph,
): Promise<void> {
  const validated = StoryGraphSchema.parse(graph);
  const path = storyGraphPath(projectRoot, projectId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(validated, null, 2), "utf-8");
}
