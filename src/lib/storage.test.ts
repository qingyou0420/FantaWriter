import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { idbGet, idbOpen } from "./idb";
import {
  flushStorage,
  importFullBackup,
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

async function openKv(name: string) {
  return idbOpen(name, 1, (db) => {
    if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
  });
}

describe("storage dual-write", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    installLocalStorage();
    resetStorageState();
  });

  afterEach(() => {
    resetStorageState();
    vi.unstubAllGlobals();
  });

  it("saveProjects writes new IDB only after brand rename", async () => {
    await initStorage();
    const a = createEmptyProject("甲");
    const b = createEmptyProject("乙");
    saveProjects([a, b]);
    await flushStorage();

    const newDb = await openKv("fantasy-writer");
    const oldDb = await openKv("erotic-novel-studio");
    const fromNew = await idbGet<typeof a[]>(newDb, "kv", "projects");
    const fromOld = await idbGet<typeof a[]>(oldDb, "kv", "projects");
    expect(fromNew?.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    expect(fromOld).toBeUndefined();
  });

  it("migrates old localStorage projects into the new IDB", async () => {
    const p = createEmptyProject("旧书");
    localStorage.setItem(
      "erotic-novel-studio:projects",
      JSON.stringify([{ ...p, writingBoard: undefined }])
    );
    await initStorage();
    const loaded = loadProjects();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(p.id);
    expect(loaded[0].writingBoard).toBe("erotic");
    await flushStorage();
    const newDb = await openKv("fantasy-writer");
    const fromNew = await idbGet<typeof p[]>(newDb, "kv", "projects");
    expect(fromNew?.map((x) => x.id)).toEqual([p.id]);
  });

  it("upsertProject refuses silent writingBoard changes", async () => {
    await initStorage();
    const p = createEmptyProject("锁", "erotic");
    saveProjects([p]);
    await flushStorage();
    expect(() =>
      upsertProject({ ...p, writingBoard: "general" })
    ).toThrow("WRITING_BOARD_LOCKED");
  });

  it("importFullBackup skips existing ids", async () => {
    await initStorage();
    const p = createEmptyProject("已有");
    saveProjects([p]);
    await flushStorage();
    const extra = createEmptyProject("新来");
    const result = importFullBackup(
      JSON.stringify({
        projects: [p, extra],
        tagLibrary: ["悬疑"],
      })
    );
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(loadProjects().map((x) => x.id).sort()).toEqual([p.id, extra.id].sort());
  });
});
