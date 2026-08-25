import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import {
  initStorage,
  loadStyleLibrary,
  loadTagLibraryFor,
  resetStorageState,
  resetTagLibraryToDefaultFor,
} from "./storage";
import { DEFAULT_GENERAL_TAG_LIBRARY } from "./types";

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

describe("library namespaces", () => {
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

  it("default tags are conventional genre tags", () => {
    const tags = resetTagLibraryToDefaultFor("general");
    expect(tags).toEqual([...DEFAULT_GENERAL_TAG_LIBRARY]);
    expect(loadTagLibraryFor("general")).toEqual([...DEFAULT_GENERAL_TAG_LIBRARY]);
    expect(tags).toContain("悬疑");
    expect(tags).toContain("奇幻");
  });

  it("reads old tag/style libraries once into the new key", async () => {
    resetStorageState();
    localStorage.removeItem("fantawriter:libraries");
    localStorage.setItem(
      "erotic-novel-studio:tag-library",
      JSON.stringify(["悬疑", "旧标签"])
    );
    localStorage.setItem(
      "erotic-novel-studio:style-library",
      JSON.stringify([
        {
          id: "old-style",
          name: "旧风",
          createdAt: "",
          updatedAt: "",
          sourceLabel: "",
          sourceChars: 10,
          overall: "",
          vocabulary: "",
          rhythm: "",
          narrative: "",
          dialogue: "",
          sensory: "",
          structure: "",
          avoid: "",
          styleGuide: "短句",
          fingerprints: [],
        },
      ])
    );
    const tags = loadTagLibraryFor("general");
    expect(tags).toEqual(["悬疑", "旧标签"]);
    expect(loadStyleLibrary()[0]?.name).toBe("旧风");
    expect(localStorage.getItem("fantawriter:libraries")).toBeTruthy();
  });
});
