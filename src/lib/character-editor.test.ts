import { describe, expect, it } from "vitest";
import {
  applyCharacterEditorSave,
  canManuallyEditCharacters,
  closeCharacterEditor,
  createCharacterDraft,
  openCharacterEditor,
} from "./character-editor";
import { createEmptyCharacter, createEmptyProject } from "./types";

describe("canManuallyEditCharacters", () => {
  it("is true for from-scratch (no original, no canon, no skeleton)", () => {
    const p = createEmptyProject("从零");
    expect(p.original).toBeNull();
    expect(p.canon).toEqual([]);
    expect(canManuallyEditCharacters(p)).toBe(true);
    expect(canManuallyEditCharacters(null)).toBe(true);
  });

  it("is true when original + locked canon exist (locks do not close the editor)", () => {
    const p = createEmptyProject("焕新");
    p.original = {
      title: "旧稿",
      sourceLabel: "粘贴导入",
      text: "原文里霜桥是北城城门。",
      updatedAt: "",
    };
    p.canon = [
      {
        id: "f1",
        name: "霜桥",
        kind: "place",
        statement: "北城城门，地点而非角色",
        locked: true,
      },
    ];
    expect(canManuallyEditCharacters(p)).toBe(true);
  });
});

describe("openCharacterEditor", () => {
  it("opens an existing from-scratch character for editing", () => {
    const p = createEmptyProject("从零");
    const first = p.characters[0];
    const state = openCharacterEditor(p.characters, first.id);
    expect(state.open).toBe(true);
    if (state.open) {
      expect(state.isNew).toBe(false);
      expect(state.draft.id).toBe(first.id);
      expect(state.draft.role).toBe("主角");
    }
  });

  it("creates a draft when the list is empty (no extract required)", () => {
    const state = openCharacterEditor([], null);
    expect(state.open).toBe(true);
    if (state.open) {
      expect(state.isNew).toBe(true);
      expect(state.draft.role).toBe("主角");
      expect(state.draft.name).toBe("");
      expect(state.draft.id).toBeTruthy();
    }
  });

  it("adds a supporting-role draft when requested", () => {
    const existing = createEmptyCharacter();
    existing.name = "甲";
    const state = openCharacterEditor([existing], null, { create: true });
    expect(state.open).toBe(true);
    if (state.open) {
      expect(state.isNew).toBe(true);
      expect(state.draft.role).toBe("配角");
      expect(state.draft.id).not.toBe(existing.id);
    }
  });
});

describe("applyCharacterEditorSave", () => {
  it("inserts a new character and updates an existing one", () => {
    const a = createEmptyCharacter();
    a.name = "甲";
    const draft = createCharacterDraft(1);
    draft.name = "乙";
    const inserted = applyCharacterEditorSave([a], draft);
    expect(inserted).toHaveLength(2);
    expect(inserted[1].name).toBe("乙");
    expect(inserted[1].role).toBe("配角");

    const edited = applyCharacterEditorSave(inserted, {
      ...a,
      personality: "沉稳",
    });
    expect(edited.find((c) => c.id === a.id)?.personality).toBe("沉稳");
    expect(edited.find((c) => c.id === draft.id)?.name).toBe("乙");
  });

  it("treats a missing list as empty instead of throwing", () => {
    const draft = createCharacterDraft(0);
    draft.name = "丙";
    const next = applyCharacterEditorSave(undefined, draft);
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe("丙");
  });
});

describe("closeCharacterEditor", () => {
  it("returns a closed state", () => {
    expect(closeCharacterEditor()).toEqual({ open: false });
  });
});
