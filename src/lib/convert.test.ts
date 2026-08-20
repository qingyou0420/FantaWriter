import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  CONVERT_UNLOCK_TOKEN,
  convertProjectWritingBoard,
  flushStorage,
  initStorage,
  loadProjects,
  resetStorageState,
  saveProjects,
  upsertProject,
} from "./storage";
import { createEmptyProject } from "./types";

function installLocalStorage() {
  const mem = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("window", globalThis);
}

describe("convertProjectWritingBoard", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    installLocalStorage();
    resetStorageState();
    await initStorage();
  });

  afterEach(() => {
    resetStorageState();
    vi.unstubAllGlobals();
  });

  it("save-as erotic → general archives tags, clears learned style, leaves source", async () => {
    const src = createEmptyProject("色书", "erotic");
    src.tags = ["口交", "女同"];
    src.settings.learnedStyleId = "s1";
    src.settings.learnedStyleGuide = "情色写法：直白";
    src.settings.learnedStyleName = "旧风";
    src.settings.writingStyle = "learned";
    src.outline = {
      premise: "p",
      endingNote: "e",
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "一",
          summary: "s",
          keyPoints: "k",
          eroticNote: "有",
          tags: [],
        },
      ],
    };
    saveProjects([src]);
    await flushStorage();

    const next = convertProjectWritingBoard(src, "general", {
      unlockToken: CONVERT_UNLOCK_TOKEN,
      title: "常书",
      keepGenreTags: ["女同"],
    });
    await flushStorage();

    expect(next.id).not.toBe(src.id);
    expect(next.writingBoard).toBe("general");
    expect(next.archivedActTags).toEqual(["口交", "女同"]);
    expect(next.tags).toEqual(["女同"]);
    expect(next.settings.learnedStyleGuide).toBe("");
    expect(next.settings.writingStyle).toBe("literary");
    expect(next.outline?.chapters[0].eroticNote).toBe("有");

    const all = loadProjects();
    const source = all.find((p) => p.id === src.id);
    expect(source?.writingBoard).toBe("erotic");
    expect(source?.tags).toEqual(["口交", "女同"]);
    expect(all.some((p) => p.id === next.id)).toBe(true);
  });

  it("rejects missing unlock token and upsert still locks", async () => {
    const src = createEmptyProject("锁", "erotic");
    saveProjects([src]);
    await flushStorage();
    expect(() =>
      convertProjectWritingBoard(src, "general", {
        unlockToken: "nope" as typeof CONVERT_UNLOCK_TOKEN,
        title: "x",
      })
    ).toThrow("WRITING_BOARD_LOCKED");
    expect(() =>
      upsertProject({ ...src, writingBoard: "general" })
    ).toThrow("WRITING_BOARD_LOCKED");
  });
});
