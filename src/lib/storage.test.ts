import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { idbGet, idbOpen, idbSet } from "./idb";
import {
  exportProjectJson,
  flushStorage,
  importFullBackup,
  importProjectJson,
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
    const fromNew = await idbGet<typeof a[]>(newDb, "kv", "projects");
    expect(fromNew?.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toContain("fantasy-writer");
    expect(names).not.toContain("erotic-novel-studio");
  });

  it("fresh start never creates the old product database", async () => {
    await initStorage();
    const p = createEmptyProject("全新");
    saveProjects([p]);
    await flushStorage();
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain("erotic-novel-studio");
    expect(localStorage.getItem("erotic-novel-studio:projects")).toBeNull();
    expect(localStorage.getItem("h-novelist:project-tab:" + p.id)).toBeNull();
  });

  it("migrates an existing old IDB into the new library", async () => {
    const p = createEmptyProject("旧库书");
    const oldDb = await openKv("erotic-novel-studio");
    await idbSet(oldDb, "kv", [p], "projects");
    await initStorage();
    const loaded = loadProjects();
    expect(loaded.map((x) => x.id)).toContain(p.id);
    await flushStorage();
    const newDb = await openKv("fantasy-writer");
    const fromNew = await idbGet<typeof p[]>(newDb, "kv", "projects");
    expect(fromNew?.map((x) => x.id)).toContain(p.id);
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
    expect(loaded[0].writingBoard).toBe("general");
    await flushStorage();
    const newDb = await openKv("fantasy-writer");
    const fromNew = await idbGet<typeof p[]>(newDb, "kv", "projects");
    expect(fromNew?.map((x) => x.id)).toEqual([p.id]);
  });

  it("normalize imported projects onto the conventional board", async () => {
    await initStorage();
    const p = createEmptyProject("锁");
    saveProjects([p]);
    await flushStorage();
    upsertProject({ ...p, name: "锁改" });
    expect(loadProjects()[0].writingBoard).toBe("general");
  });

  it("export/import project JSON keeps original manuscript and locked canon", async () => {
    await initStorage();
    const p = createEmptyProject("醉词", "general");
    p.original = {
      title: "醉词",
      sourceLabel: "粘贴导入",
      text: "清溪是流渊的白色战马。",
      updatedAt: "2026-08-20T00:00:00.000Z",
    };
    p.canon = [
      {
        id: "c1",
        name: "清溪",
        kind: "identity",
        statement: "流渊的白色战马，不是人，不是女性。",
        locked: true,
        aliases: [],
      },
    ];
    const json = exportProjectJson(p);
    const imported = importProjectJson(json);
    expect(imported.original?.text).toContain("白色战马");
    expect(imported.canon?.[0].name).toBe("清溪");
    expect(imported.canon?.[0].locked).toBe(true);
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
