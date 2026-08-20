import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import {
  initStorage,
  loadTagLibraryFor,
  resetStorageState,
  resetTagLibraryToDefaultFor,
} from "./storage";
import { DEFAULT_GENERAL_TAG_LIBRARY, DEFAULT_TAG_LIBRARY } from "./types";

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

  it("general default tags are not erotic act tags", () => {
    const general = resetTagLibraryToDefaultFor("general");
    const erotic = loadTagLibraryFor("erotic");
    expect(general).toEqual([...DEFAULT_GENERAL_TAG_LIBRARY]);
    expect(general).not.toContain("口交");
    expect(erotic).toContain("口交");
    expect(erotic).toEqual([...DEFAULT_TAG_LIBRARY]);
  });
});
