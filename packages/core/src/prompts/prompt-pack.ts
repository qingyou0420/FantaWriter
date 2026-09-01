import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BUILTIN_PROMPTS, BUILTIN_PROMPT_PACKS, type BuiltinPrompt } from "./builtin-prompts.js";

export type PromptSource = "project" | "user" | "builtin";

export interface LoadedPromptPackPrompt {
  readonly promptId: string;
  readonly content: string;
  readonly source: PromptSource;
  readonly path?: string;
  readonly title?: string;
  readonly packId?: string;
}

export interface LoadPromptPackPromptInput {
  readonly promptId: string;
  readonly projectRoot?: string;
  readonly userRoot?: string;
}

export class PromptPackPromptNotFoundError extends Error {
  readonly code = "PROMPT_PACK_PROMPT_NOT_FOUND";

  constructor(readonly promptId: string) {
    super(`Prompt pack prompt not found: ${promptId}`);
    this.name = "PromptPackPromptNotFoundError";
  }
}

const BUILTIN_PROMPT_BY_ID = new Map(BUILTIN_PROMPTS.map((prompt) => [prompt.id, prompt]));

export function listBuiltinPromptPacks() {
  return BUILTIN_PROMPT_PACKS;
}

export function listBuiltinPrompts(): ReadonlyArray<BuiltinPrompt> {
  return BUILTIN_PROMPTS;
}

export function getBuiltinPrompt(promptId: string): LoadedPromptPackPrompt | undefined {
  const normalized = normalizePromptId(promptId);
  const prompt = BUILTIN_PROMPT_BY_ID.get(normalized);
  if (!prompt) return undefined;
  return {
    promptId: prompt.id,
    content: prompt.content,
    source: "builtin",
    title: prompt.title,
    packId: prompt.packId,
  };
}

export async function loadPromptPackPrompt(input: LoadPromptPackPromptInput): Promise<LoadedPromptPackPrompt> {
  const promptId = normalizePromptId(input.promptId);

  if (input.projectRoot) {
    const projectPath = promptOverridePath(input.projectRoot, promptId);
    const content = await readTextIfExists(projectPath);
    if (content !== undefined) {
      return { promptId, content, source: "project", path: projectPath };
    }
  }

  if (input.userRoot) {
    const userPath = promptOverridePath(input.userRoot, promptId);
    const content = await readTextIfExists(userPath);
    if (content !== undefined) {
      return { promptId, content, source: "user", path: userPath };
    }
  }

  const builtin = getBuiltinPrompt(promptId);
  if (builtin) return builtin;

  throw new PromptPackPromptNotFoundError(promptId);
}

export async function appendPromptPackGuidance(
  basePrompt: string,
  input: LoadPromptPackPromptInput,
): Promise<string> {
  const prompt = await loadPromptPackPrompt(input);
  const content = prompt.content.trim();
  if (!content) return basePrompt;
  return [
    basePrompt,
    "",
    `## Prompt Pack Guidance (${prompt.promptId}, source: ${prompt.source})`,
    content,
  ].join("\n");
}

export function promptOverridePath(root: string, promptId: string): string {
  const normalized = normalizePromptId(promptId);
  const parts = normalized.split(".");
  return join(root, "prompt", ...parts.slice(0, -1), `${parts.at(-1)}.md`);
}

function normalizePromptId(promptId: string): string {
  return promptId.trim().toLowerCase();
}

async function readTextIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return undefined;
  }
}
