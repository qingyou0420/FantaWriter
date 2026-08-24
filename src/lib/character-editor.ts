import {
  createEmptyCharacter,
  type Character,
  type NovelProject,
} from "./types";

export type CharacterEditorState =
  | { open: false }
  | { open: true; draft: Character; isNew: boolean };

/**
 * Manual create/edit is always allowed.
 * extract_canon / extract_skeleton / locked facts only constrain AI generate,
 * never whether the author can open the editor — including 从零开写.
 */
export function canManuallyEditCharacters(
  _project?: Pick<NovelProject, "original" | "canon"> | null
): boolean {
  return true;
}

export function createCharacterDraft(existingCount: number): Character {
  const c = createEmptyCharacter();
  c.role = existingCount ? "配角" : "主角";
  return c;
}

export function openCharacterEditor(
  characters: Character[] | null | undefined,
  id?: string | null,
  opts?: { create?: boolean }
): CharacterEditorState {
  const list = Array.isArray(characters) ? characters : [];
  if (opts?.create || !list.length) {
    return { open: true, draft: createCharacterDraft(list.length), isNew: true };
  }
  const hit = id ? list.find((c) => c.id === id) : list[0];
  if (!hit) {
    return { open: true, draft: createCharacterDraft(list.length), isNew: true };
  }
  return { open: true, draft: { ...hit }, isNew: false };
}

export function applyCharacterEditorSave(
  characters: Character[] | null | undefined,
  draft: Character
): Character[] {
  const list = Array.isArray(characters) ? characters : [];
  const idx = list.findIndex((c) => c.id === draft.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...draft };
    return next;
  }
  return [...list, { ...draft }];
}

export function closeCharacterEditor(): CharacterEditorState {
  return { open: false };
}
