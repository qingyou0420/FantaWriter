import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import {
  initStorage,
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
});
