export interface StudioPromptPack {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly prompts: ReadonlyArray<string>;
}

export interface StudioPromptPackPrompt {
  readonly id: string;
  readonly packId: string;
  readonly title: string;
  readonly defaultContent?: string;
  readonly content?: string;
  readonly source: string;
  readonly overridden: boolean;
  readonly path?: string;
}

export interface PromptPacksResponse {
  readonly packs: ReadonlyArray<StudioPromptPack>;
  readonly prompts: ReadonlyArray<StudioPromptPackPrompt>;
}

export interface PromptPackDisplayGroup {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly prompts: ReadonlyArray<StudioPromptPackPrompt>;
}

export function groupPromptPacksForDisplay(input: PromptPacksResponse): PromptPackDisplayGroup[] {
  const promptsByPack = new Map<string, StudioPromptPackPrompt[]>();
  for (const prompt of input.prompts) {
    const group = promptsByPack.get(prompt.packId) ?? [];
    group.push(prompt);
    promptsByPack.set(prompt.packId, group);
  }

  const groups: PromptPackDisplayGroup[] = [];
  const seen = new Set<string>();
  for (const pack of input.packs) {
    seen.add(pack.id);
    const prompts = promptsByPack.get(pack.id) ?? [];
    groups.push({
      id: pack.id,
      title: pack.title,
      description: pack.description,
      prompts: sortPromptsByPackManifest(prompts, pack.prompts),
    });
  }

  for (const [packId, prompts] of promptsByPack) {
    if (seen.has(packId)) continue;
    groups.push({
      id: packId,
      title: packId,
      prompts: prompts.slice().sort((a, b) => a.id.localeCompare(b.id)),
    });
  }
  return groups;
}

function sortPromptsByPackManifest(
  prompts: ReadonlyArray<StudioPromptPackPrompt>,
  manifestOrder: ReadonlyArray<string>,
): StudioPromptPackPrompt[] {
  const order = new Map(manifestOrder.map((id, index) => [id, index]));
  return prompts.slice().sort((a, b) => {
    const left = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const right = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    return a.id.localeCompare(b.id);
  });
}
