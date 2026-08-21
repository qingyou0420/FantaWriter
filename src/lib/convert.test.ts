import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  flushStorage,
  initStorage,
  resetStorageState,
  saveProjects,
} from "./storage";
import { createEmptyProject, normalizeProject } from "./types";

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

describe("conventional edition project board", () => {
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

  it("forces imported payloads onto the conventional board", async () => {
    const src = createEmptyProject("旧书");
    src.tags = ["悬疑", "成长"];
    saveProjects([src]);
    await flushStorage();
    const next = normalizeProject({
      ...src,
      writingBoard: "general",
    });
    expect(next.writingBoard).toBe("general");
    expect(next.tags).toEqual(["悬疑", "成长"]);
  });
});
