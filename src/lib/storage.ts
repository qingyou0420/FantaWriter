import {
  DEFAULT_GENERAL_TAG_LIBRARY,
  DEFAULT_READER_PREFS,
  assertWritingBoardImmutable,
  createEmptyUsageStats,
  normalizeLearnedStyle,
  normalizeProject,
  type LearnedStyle,
  type NovelProject,
  type ReaderPrefs,
  type UsageStats,
  type WritingBoard,
} from "./types";
import { resolveFlag } from "./flags";
import { loadAppPrefs, saveAppPrefs } from "./theme";
import { idbGet, idbOpen, idbSet } from "./idb";

/** 旧键：M0–M3 双读双写 */
const OLD_PROJECTS_LS = "erotic-novel-studio:projects";
const OLD_TAG_LIBRARY_KEY = "erotic-novel-studio:tag-library";
const OLD_STYLE_LIBRARY_KEY = "erotic-novel-studio:style-library";
const OLD_READER_PREFS_KEY = "erotic-novel-studio:reader-prefs";
const OLD_USAGE_STATS_KEY = "erotic-novel-studio:usage-stats";
const OLD_BACKUP_META_KEY = "erotic-novel-studio:backup-meta";
const OLD_IDB_NAME = "erotic-novel-studio";

const NEW_PROJECTS_LS = "fantasy-writer:projects";
const NEW_LIBRARIES_KEY = "fantasy-writer:libraries";
const NEW_READER_PREFS_KEY = "fantasy-writer:reader-prefs";
const NEW_USAGE_STATS_KEY = "fantasy-writer:usage-stats";
const NEW_BACKUP_META_KEY = "fantasy-writer:backup-meta";
const NEW_IDB_NAME = "fantasy-writer";

const IDB_VERSION = 1;
const IDB_STORE = "kv";

export type BoardLibraries = {
  tags: string[];
  styles: LearnedStyle[];
};

export type StoredLibraries = {
  general: BoardLibraries;
};

let projectsCache: NovelProject[] | null = null;
let storageReady: Promise<void> | null = null;
let persistChain: Promise<void> = Promise.resolve();
let lastStorageError: unknown = null;

async function openKv(name: string) {
  return idbOpen(name, IDB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(IDB_STORE)) {
      db.createObjectStore(IDB_STORE);
    }
  });
}

async function getNewDb() {
  return openKv(NEW_IDB_NAME);
}

async function getOldDb() {
  return openKv(OLD_IDB_NAME);
}

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function lsReadNewThenOld(newKey: string, oldKey: string): string | null {
  return lsGet(newKey) ?? lsGet(oldKey);
}

function shouldDualWriteOld(): boolean {
  try {
    return !resolveFlag("brandRenameComplete", loadAppPrefs());
  } catch {
    return false;
  }
}

function lsWriteDual(newKey: string, oldKey: string, value: string) {
  lsSet(newKey, value);
  if (shouldDualWriteOld()) lsSet(oldKey, value);
}

function parseProjectsJson(raw: string | null): NovelProject[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as NovelProject[];
    return Array.isArray(data) ? data.map(normalizeProject) : [];
  } catch {
    return [];
  }
}

async function readIdbProjects(name: string): Promise<NovelProject[] | null> {
  try {
    const db = await openKv(name);
    const fromIdb = await idbGet<NovelProject[]>(db, IDB_STORE, "projects");
    if (Array.isArray(fromIdb) && fromIdb.length) {
      return fromIdb.map(normalizeProject);
    }
    return Array.isArray(fromIdb) ? fromIdb : null;
  } catch {
    return null;
  }
}

async function writeIdbProjects(
  name: string,
  projects: NovelProject[]
): Promise<void> {
  const db = await openKv(name);
  await idbSet(db, IDB_STORE, projects, "projects");
}

function seedDefaultBoardIfMigrating(count: number) {
  if (count <= 0) return;
  const prefs = loadAppPrefs();
  if (prefs.defaultBoard === "general") return;
  saveAppPrefs({ ...prefs, defaultBoard: "general" });
}

/** 测试用：清空内存缓存，使下一次 initStorage 重新跑 */
export function resetStorageState() {
  projectsCache = null;
  storageReady = null;
  persistChain = Promise.resolve();
  lastStorageError = null;
}

export function getLastStorageError(): unknown {
  return lastStorageError;
}

export function flushStorage(): Promise<void> {
  return persistChain;
}

/** 启动时：新 IDB → 旧 IDB → 旧 LS；随后双写旧 IDB */
export async function initStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  if (storageReady) return storageReady;
  storageReady = (async () => {
    try {
      const fromNew = await readIdbProjects(NEW_IDB_NAME);
      if (fromNew && fromNew.length) {
        if (!projectsCache) projectsCache = fromNew;
        try {
          await writeIdbProjects(OLD_IDB_NAME, projectsCache);
        } catch {
          /* 旧镜像失败不阻断启动 */
        }
        migrateLibrariesIfNeeded();
        await copyAutoBackupIfNeeded();
        return;
      }

      const fromOldIdb = await readIdbProjects(OLD_IDB_NAME);
      const fromOldLs = parseProjectsJson(lsGet(OLD_PROJECTS_LS));
      const fromNewLs = parseProjectsJson(lsGet(NEW_PROJECTS_LS));
      const migrated =
        (fromOldIdb && fromOldIdb.length ? fromOldIdb : null) ||
        (fromNewLs.length ? fromNewLs : null) ||
        (fromOldLs.length ? fromOldLs : null) ||
        [];

      if (!projectsCache) {
        projectsCache = migrated;
      }

      if (migrated.length) {
        try {
          const newDb = await getNewDb();
          const existingSnap = await idbGet(newDb, IDB_STORE, "migration-backup-v2");
          if (!existingSnap) {
            await idbSet(
              newDb,
              IDB_STORE,
              { at: new Date().toISOString(), projects: migrated },
              "migration-backup-v2"
            );
          }
        } catch {
          /* ignore */
        }
        seedDefaultBoardIfMigrating(migrated.length);
      }

      const json = JSON.stringify(projectsCache);
      lsSet(NEW_PROJECTS_LS, json);
      if (shouldDualWriteOld()) lsSet(OLD_PROJECTS_LS, json);
      await writeIdbProjects(NEW_IDB_NAME, projectsCache);
      if (shouldDualWriteOld()) {
        try {
          await writeIdbProjects(OLD_IDB_NAME, projectsCache);
        } catch {
          /* ignore on boot */
        }
      }
      migrateLibrariesIfNeeded();
      await copyAutoBackupIfNeeded();
    } catch {
      try {
        if (!projectsCache) {
          projectsCache = parseProjectsJson(
            lsReadNewThenOld(NEW_PROJECTS_LS, OLD_PROJECTS_LS)
          );
        }
      } catch {
        if (!projectsCache) projectsCache = [];
      }
      migrateLibrariesIfNeeded();
    }
  })();
  return storageReady;
}

export function loadProjects(): NovelProject[] {
  if (projectsCache) return projectsCache.map(normalizeProject);
  if (typeof window === "undefined") return [];
  return parseProjectsJson(
    lsReadNewThenOld(NEW_PROJECTS_LS, OLD_PROJECTS_LS)
  );
}

async function persistProjects(normalized: NovelProject[]): Promise<void> {
  lastStorageError = null;
  const json = JSON.stringify(normalized);
  lsSet(NEW_PROJECTS_LS, json);
  if (shouldDualWriteOld()) lsSet(OLD_PROJECTS_LS, json);
  await writeIdbProjects(NEW_IDB_NAME, normalized);
  if (shouldDualWriteOld()) {
    try {
      await writeIdbProjects(OLD_IDB_NAME, normalized);
    } catch (e) {
      lastStorageError = e;
      throw e;
    }
  }
  maybeAutoBackup(normalized);
}

export function saveProjects(projects: NovelProject[]): void {
  const normalized = projects.map(normalizeProject);
  projectsCache = normalized;
  if (typeof window === "undefined") return;
  persistChain = persistProjects(normalized).catch((e) => {
    lastStorageError = e;
  });
}

export function getProject(id: string): NovelProject | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function upsertProject(project: NovelProject): void {
  const list = loadProjects();
  const idx = list.findIndex((p) => p.id === project.id);
  const prev = idx >= 0 ? list[idx] : undefined;
  const next = normalizeProject({
    ...project,
    updatedAt: new Date().toISOString(),
  });
  assertWritingBoardImmutable(prev, next);
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  saveProjects(list);
}

export function deleteProject(id: string): void {
  saveProjects(loadProjects().filter((p) => p.id !== id));
}

export function exportProjectJson(project: NovelProject): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectJson(json: string): NovelProject {
  const data = JSON.parse(json) as NovelProject;
  if (!data.id || !data.name) throw new Error("无效的项目文件");
  data.id = crypto.randomUUID();
  data.updatedAt = new Date().toISOString();
  return normalizeProject(data);
}

export function importFullBackup(json: string): {
  imported: number;
  skipped: number;
} {
  const data = JSON.parse(json) as {
    projects?: NovelProject[];
    tagLibrary?: string[];
    styleLibrary?: LearnedStyle[];
    usageStats?: UsageStats;
    readerPrefs?: ReaderPrefs;
    libraries?: StoredLibraries;
  };
  if (!Array.isArray(data.projects)) throw new Error("无效的备份文件");
  const existing = loadProjects();
  const ids = new Set(existing.map((p) => p.id));
  let imported = 0;
  let skipped = 0;
  const next = [...existing];
  for (const raw of data.projects) {
    const n = normalizeProject(raw);
    if (!n.id) {
      skipped += 1;
      continue;
    }
    if (ids.has(n.id)) {
      skipped += 1;
      continue;
    }
    ids.add(n.id);
    next.push(n);
    imported += 1;
  }
  saveProjects(next);

  const libs = loadLibraries();
  if (Array.isArray(data.tagLibrary) && data.tagLibrary.length) {
    const merged = [...libs.general.tags];
    const seen = new Set(merged);
    for (const t of data.tagLibrary) {
      const s = String(t).trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        merged.push(s);
      }
    }
    libs.general.tags = merged;
  }
  if (Array.isArray(data.styleLibrary)) {
    const byId = new Map(libs.general.styles.map((s) => [s.id, s]));
    for (const s of data.styleLibrary) {
      const n = normalizeLearnedStyle(s);
      if (!byId.has(n.id)) {
        libs.general.styles.push(n);
        byId.set(n.id, n);
      }
    }
  }
  if (data.libraries?.general) {
    if (data.libraries.general.tags?.length) {
      const seen = new Set(libs.general.tags);
      for (const t of data.libraries.general.tags) {
        const s = String(t).trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          libs.general.tags.push(s);
        }
      }
    }
    if (data.libraries.general.styles?.length) {
      const byId = new Map(libs.general.styles.map((s) => [s.id, s]));
      for (const s of data.libraries.general.styles) {
        const n = normalizeLearnedStyle(s);
        if (!byId.has(n.id)) {
          libs.general.styles.push(n);
          byId.set(n.id, n);
        }
      }
    }
  }
  saveLibraries(libs);
  if (data.usageStats) {
    lsWriteDual(
      NEW_USAGE_STATS_KEY,
      OLD_USAGE_STATS_KEY,
      JSON.stringify({ ...createEmptyUsageStats(), ...data.usageStats })
    );
  }
  if (data.readerPrefs) {
    saveReaderPrefs({ ...DEFAULT_READER_PREFS, ...data.readerPrefs });
  }
  return { imported, skipped };
}

function emptyLibraries(): StoredLibraries {
  return {
    general: { tags: [...DEFAULT_GENERAL_TAG_LIBRARY], styles: [] },
  };
}

function parseLibraries(raw: string | null): StoredLibraries | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredLibraries> & {
      erotic?: BoardLibraries;
    };
    if (!data || typeof data !== "object") return null;
    const base = emptyLibraries();
    if (data.general?.tags) base.general.tags = data.general.tags.map(String);
    if (data.general?.styles) {
      base.general.styles = data.general.styles.map(normalizeLearnedStyle);
    }
    return base;
  } catch {
    return null;
  }
}

export function loadLibraries(): StoredLibraries {
  const parsed = parseLibraries(lsGet(NEW_LIBRARIES_KEY));
  if (parsed) return parsed;
  return emptyLibraries();
}

export function saveLibraries(libs: StoredLibraries): void {
  lsSet(NEW_LIBRARIES_KEY, JSON.stringify({ general: libs.general }));
}

function migrateLibrariesIfNeeded() {
  if (typeof window === "undefined") return;
  if (lsGet(NEW_LIBRARIES_KEY)) return;
  saveLibraries(emptyLibraries());
}

async function copyAutoBackupIfNeeded() {
  try {
    const newDb = await getNewDb();
    const existing = await idbGet(newDb, IDB_STORE, "auto-backup");
    if (existing) return;
    const oldDb = await getOldDb();
    const old = await idbGet(oldDb, IDB_STORE, "auto-backup");
    if (old) await idbSet(newDb, IDB_STORE, old, "auto-backup");
  } catch {
    /* ignore */
  }
}

function cleanTagList(tags: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const t of tags) {
    const s = t.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      clean.push(s);
    }
  }
  return clean;
}

export function loadTagLibraryFor(_board?: WritingBoard): string[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_GENERAL_TAG_LIBRARY];
  }
  migrateLibrariesIfNeeded();
  const libs = loadLibraries();
  const tags = libs.general.tags;
  if (tags.length) return tags;
  return [...DEFAULT_GENERAL_TAG_LIBRARY];
}

export function loadTagLibrary(): string[] {
  return loadTagLibraryFor("general");
}

export function saveTagLibraryFor(_board: WritingBoard | undefined, tags: string[]): void {
  if (typeof window === "undefined") return;
  const clean = cleanTagList(tags);
  const libs = loadLibraries();
  libs.general.tags = clean;
  saveLibraries(libs);
}

export function saveTagLibrary(tags: string[]): void {
  saveTagLibraryFor("general", tags);
}

export function addTagsToLibrary(tags: string[]): string[] {
  const lib = loadTagLibrary();
  const seen = new Set(lib);
  for (const t of tags) {
    const s = t.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      lib.push(s);
    }
  }
  saveTagLibrary(lib);
  return lib;
}

export function removeTagFromLibrary(tag: string): string[] {
  const lib = loadTagLibrary().filter((t) => t !== tag);
  saveTagLibrary(lib);
  return lib;
}

export function resetTagLibraryToDefaultFor(_board?: WritingBoard): string[] {
  const initial = [...DEFAULT_GENERAL_TAG_LIBRARY];
  saveTagLibraryFor("general", initial);
  return initial;
}

export function resetTagLibraryToDefault(): string[] {
  return resetTagLibraryToDefaultFor("general");
}

export function loadStyleLibraryFor(_board?: WritingBoard): LearnedStyle[] {
  if (typeof window === "undefined") return [];
  migrateLibrariesIfNeeded();
  const libs = loadLibraries();
  return libs.general.styles.map(normalizeLearnedStyle);
}

export function loadStyleLibrary(): LearnedStyle[] {
  return loadStyleLibraryFor("general");
}

export function saveStyleLibraryFor(
  _board: WritingBoard | undefined,
  styles: LearnedStyle[]
): void {
  if (typeof window === "undefined") return;
  const libs = loadLibraries();
  libs.general.styles = styles.map((s) =>
    normalizeLearnedStyle({ ...s, writingBoard: "general" })
  );
  saveLibraries(libs);
}

export function saveStyleLibrary(styles: LearnedStyle[]): void {
  saveStyleLibraryFor("general", styles);
}

export function upsertLearnedStyle(style: LearnedStyle): LearnedStyle[] {
  const n = normalizeLearnedStyle({ ...style, writingBoard: "general" });
  const list = loadStyleLibraryFor("general");
  const idx = list.findIndex((s) => s.id === n.id);
  if (idx >= 0) list[idx] = n;
  else list.unshift(n);
  saveStyleLibraryFor("general", list);
  return list;
}

export function deleteLearnedStyle(id: string): LearnedStyle[] {
  const list = loadStyleLibraryFor("general").filter((s) => s.id !== id);
  saveStyleLibraryFor("general", list);
  return list;
}

export function getLearnedStyle(id: string): LearnedStyle | null {
  return loadStyleLibraryFor("general").find((s) => s.id === id) ?? null;
}

/** 阅读偏好 */
export function loadReaderPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_READER_PREFS };
  try {
    const raw = lsReadNewThenOld(NEW_READER_PREFS_KEY, OLD_READER_PREFS_KEY);
    if (!raw) return { ...DEFAULT_READER_PREFS };
    return { ...DEFAULT_READER_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_READER_PREFS };
  }
}

export function saveReaderPrefs(prefs: ReaderPrefs): void {
  lsWriteDual(NEW_READER_PREFS_KEY, OLD_READER_PREFS_KEY, JSON.stringify(prefs));
}

/** 用量统计 */
export function loadUsageStats(): UsageStats {
  if (typeof window === "undefined") return createEmptyUsageStats();
  try {
    const raw = lsReadNewThenOld(NEW_USAGE_STATS_KEY, OLD_USAGE_STATS_KEY);
    if (!raw) return createEmptyUsageStats();
    return { ...createEmptyUsageStats(), ...JSON.parse(raw) };
  } catch {
    return createEmptyUsageStats();
  }
}

export function recordUsage(mode: string, charsIn: number, charsOut: number) {
  const s = loadUsageStats();
  s.totalRequests += 1;
  s.totalCharsIn += Math.max(0, charsIn);
  s.totalCharsOut += Math.max(0, charsOut);
  if (!s.byMode[mode]) s.byMode[mode] = { requests: 0, charsOut: 0 };
  s.byMode[mode].requests += 1;
  s.byMode[mode].charsOut += Math.max(0, charsOut);
  s.lastUsedAt = new Date().toISOString();
  lsWriteDual(NEW_USAGE_STATS_KEY, OLD_USAGE_STATS_KEY, JSON.stringify(s));
  return s;
}

export function resetUsageStats(): UsageStats {
  const s = createEmptyUsageStats();
  lsWriteDual(NEW_USAGE_STATS_KEY, OLD_USAGE_STATS_KEY, JSON.stringify(s));
  return s;
}

/** 自动备份：每 6 小时把全库 JSON 写入 IDB，并提示可手动下载 */
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function maybeAutoBackup(projects: NovelProject[]) {
  try {
    const metaRaw = lsReadNewThenOld(NEW_BACKUP_META_KEY, OLD_BACKUP_META_KEY);
    const meta = metaRaw
      ? (JSON.parse(metaRaw) as { lastAt?: number })
      : {};
    const now = Date.now();
    if (meta.lastAt && now - meta.lastAt < BACKUP_INTERVAL_MS) return;
    lsWriteDual(
      NEW_BACKUP_META_KEY,
      OLD_BACKUP_META_KEY,
      JSON.stringify({ lastAt: now })
    );
    void (async () => {
      const payload = {
        at: new Date().toISOString(),
        projects,
      };
      try {
        const newDb = await getNewDb();
        await idbSet(newDb, IDB_STORE, payload, "auto-backup");
      } catch {
        /* ignore */
      }
      if (shouldDualWriteOld()) {
        try {
          const oldDb = await getOldDb();
          await idbSet(oldDb, IDB_STORE, payload, "auto-backup");
        } catch {
          /* ignore */
        }
      }
    })();
  } catch {
    /* ignore */
  }
}

export async function getAutoBackup(): Promise<{
  at: string;
  projects: NovelProject[];
} | null> {
  try {
    const newDb = await getNewDb();
    const fromNew = await idbGet<{ at: string; projects: NovelProject[] }>(
      newDb,
      IDB_STORE,
      "auto-backup"
    );
    if (fromNew) return fromNew;
    const oldDb = await getOldDb();
    const fromOld = await idbGet<{ at: string; projects: NovelProject[] }>(
      oldDb,
      IDB_STORE,
      "auto-backup"
    );
    return fromOld || null;
  } catch {
    return null;
  }
}

export function downloadFullBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    projects: loadProjects(),
    tagLibrary: loadTagLibrary(),
    styleLibrary: loadStyleLibrary(),
    usageStats: loadUsageStats(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fw-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function projectTabKeyNew(projectId: string): string {
  return `fantasy-writer:project-tab:${projectId}`;
}

export function projectTabKeyOld(projectId: string): string {
  return `h-novelist:project-tab:${projectId}`;
}

export function readProjectTab(projectId: string): string | null {
  return lsReadNewThenOld(
    projectTabKeyNew(projectId),
    projectTabKeyOld(projectId)
  );
}

export function writeProjectTab(projectId: string, tab: string): void {
  lsWriteDual(projectTabKeyNew(projectId), projectTabKeyOld(projectId), tab);
}
