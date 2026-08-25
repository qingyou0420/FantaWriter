import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import * as idb from "./idb";
import { idbGet, idbOpen, idbSet } from "./idb";
import {
  exportProjectJson,
  flushStorage,
  getLastStorageError,
  importFullBackup,
  importProjectJson,
  initStorage,
  isFullBackupJson,
  loadProjects,
  projectIdbKey,
  resetStorageState,
  restoreFromAutoBackup,
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

    const newDb = await openKv("fantawriter");
    const ids = await idbGet<string[]>(newDb, "kv", "project-ids");
    expect(ids?.sort()).toEqual([a.id, b.id].sort());
    const fromA = await idbGet<typeof a>(newDb, "kv", projectIdbKey(a.id));
    const fromB = await idbGet<typeof b>(newDb, "kv", projectIdbKey(b.id));
    expect(fromA?.id).toBe(a.id);
    expect(fromB?.id).toBe(b.id);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toContain("fantawriter");
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
    const newDb = await openKv("fantawriter");
    const fromNew = await idbGet<typeof p>(newDb, "kv", projectIdbKey(p.id));
    expect(fromNew?.id).toBe(p.id);
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
    const newDb = await openKv("fantawriter");
    const fromNew = await idbGet<typeof p>(newDb, "kv", projectIdbKey(p.id));
    expect(fromNew?.id).toBe(p.id);
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

  it("persist failure can be queried via getLastStorageError", async () => {
    await initStorage();
    const p = createEmptyProject("失败");
    const spy = vi.spyOn(idb, "idbSet").mockRejectedValue(new Error("idb down"));
    saveProjects([p]);
    await flushStorage();
    expect(getLastStorageError()).toBeTruthy();
    expect(String(getLastStorageError())).toMatch(/idb down/);
    spy.mockRestore();
  });

  it("migrates legacy single-key projects to per-project keys", async () => {
    const p = createEmptyProject("旧单键");
    const db = await openKv("fantawriter");
    await idbSet(db, "kv", [p], "projects");
    await initStorage();
    expect(loadProjects().map((x) => x.id)).toContain(p.id);
    const snap = await idbGet<{ projects: typeof p[] }>(
      db,
      "kv",
      "migration-backup-v3"
    );
    expect(snap?.projects?.map((x) => x.id)).toContain(p.id);
    const row = await idbGet<typeof p>(db, "kv", projectIdbKey(p.id));
    expect(row?.id).toBe(p.id);
  });

  it("editing a small project does not rewrite the large project key", async () => {
    await initStorage();
    const big = createEmptyProject("大项目");
    const small = createEmptyProject("小项目");
    saveProjects([big, small]);
    await flushStorage();
    const spy = vi.spyOn(idb, "idbSet");
    upsertProject({ ...small, name: "小项目改名" });
    await flushStorage();
    const keys = spy.mock.calls.map((c) => c[3]);
    expect(keys).toContain(projectIdbKey(small.id));
    expect(keys).not.toContain(projectIdbKey(big.id));
    spy.mockRestore();
  });

  it("LS mirror stores metadata only", async () => {
    await initStorage();
    const p = createEmptyProject("元数据");
    saveProjects([p]);
    await flushStorage();
    const raw = localStorage.getItem("fantawriter:projects");
    const parsed = JSON.parse(String(raw));
    expect(parsed.at).toBeTruthy();
    expect(parsed.projects[0]).toMatchObject({
      id: p.id,
      name: p.name,
    });
    expect(parsed.projects[0].chapters).toBeUndefined();
  });

  it("isFullBackupJson detects {projects:[]} backups", () => {
    expect(isFullBackupJson(JSON.stringify({ projects: [] }))).toBe(true);
    expect(
      isFullBackupJson(JSON.stringify({ id: "x", name: "单书", chapters: [] }))
    ).toBe(false);
  });

  it("restoreFromAutoBackup writes pre-restore snapshot", async () => {
    await initStorage();
    const old = createEmptyProject("旧库");
    const next = createEmptyProject("备份里的书");
    saveProjects([old]);
    await flushStorage();
    const db = await openKv("fantawriter");
    await idbSet(db, "kv", { at: "2026-08-01T00:00:00.000Z", projects: [next] }, "auto-backup");
    const r = await restoreFromAutoBackup();
    expect(r.restored).toBe(1);
    expect(loadProjects().map((p) => p.id)).toEqual([next.id]);
    const snap = await idbGet<{ projects: { id: string }[] }>(
      db,
      "kv",
      "pre-restore-backup"
    );
    expect(snap?.projects?.map((p) => p.id)).toContain(old.id);
  });
});
