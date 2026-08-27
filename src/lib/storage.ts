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
import { loadAppPrefs, saveAppPrefs } from "./theme";
import { getDesktop } from "./desktop";
import { desktopBackupFileName } from "./desktop-backup";
import { idbDelete, idbGet, idbKeys, idbOpen, idbSet } from "./idb";

/** 旧键：M0–M3 双读双写 */
const OLD_PROJECTS_LS = "erotic-novel-studio:projects";
const OLD_TAG_LIBRARY_KEY = "erotic-novel-studio:tag-library";
const OLD_STYLE_LIBRARY_KEY = "erotic-novel-studio:style-library";
const OLD_READER_PREFS_KEY = "erotic-novel-studio:reader-prefs";
const OLD_USAGE_STATS_KEY = "erotic-novel-studio:usage-stats";
const OLD_BACKUP_META_KEY = "erotic-novel-studio:backup-meta";
const OLD_IDB_NAME = "erotic-novel-studio";

const NEW_PROJECTS_LS = "fantawriter:projects";
const NEW_LIBRARIES_KEY = "fantawriter:libraries";
const NEW_READER_PREFS_KEY = "fantawriter:reader-prefs";
const NEW_USAGE_STATS_KEY = "fantawriter:usage-stats";
const NEW_BACKUP_META_KEY = "fantawriter:backup-meta";
const NEW_IDB_NAME = "fantawriter";

const IDB_VERSION = 1;
const IDB_STORE = "kv";
const IDB_PROJECT_INDEX = "project-ids";
const IDB_PROJECT_PREFIX = "project:";
const IDB_MIGRATION_V3 = "migration-backup-v3";
const IDB_PRE_RESTORE = "pre-restore-backup";

export type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: string;
};

export type ProjectsLsMirror = {
  at: string;
  projects: ProjectMeta[];
};

export function projectIdbKey(id: string): string {
  return `${IDB_PROJECT_PREFIX}${id}`;
}

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
let lastStorageWarning: string | null = null;
/** 上次成功写入 IDB 的项目 JSON，用于只写脏项目 */
const lastWrittenJson = new Map<string, string>();

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
  } catch (e) {
    lastStorageError =
      e instanceof Error
        ? e
        : new Error("localStorage 写入失败（可能超过 5MB 配额）");
    lastStorageWarning =
      "本地镜像已停更（超过约 5MB 配额）。主库若写入成功，请立刻下载完整备份。";
  }
}

function lsReadNewThenOld(newKey: string, oldKey: string): string | null {
  return lsGet(newKey) ?? lsGet(oldKey);
}

async function oldIdbExists(): Promise<boolean> {
  try {
    if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => d.name === OLD_IDB_NAME);
    }
  } catch {
    /* ignore */
  }
  return Boolean(lsGet(OLD_PROJECTS_LS));
}

function parseProjectsJson(raw: string | null): NovelProject[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) return data.map((p) => normalizeProject(p as NovelProject));
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as { projects?: unknown }).projects)
    ) {
      const rows = (data as { projects: unknown[] }).projects;
      if (rows.some((p) => p && typeof p === "object" && "chapters" in (p as object))) {
        return rows.map((p) => normalizeProject(p as NovelProject));
      }
    }
    return [];
  } catch {
    return [];
  }
}

function parseLsMirror(raw: string | null): ProjectsLsMirror | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      return {
        at: "",
        projects: data
          .filter((p): p is NovelProject => Boolean(p && typeof p === "object"))
          .map((p) => ({
            id: String((p as NovelProject).id || ""),
            name: String((p as NovelProject).name || ""),
            updatedAt: String((p as NovelProject).updatedAt || ""),
          }))
          .filter((p) => p.id),
      };
    }
    if (data && typeof data === "object" && Array.isArray((data as ProjectsLsMirror).projects)) {
      const at = String((data as ProjectsLsMirror).at || "");
      const projects = (data as ProjectsLsMirror).projects
        .map((p) => ({
          id: String(p.id || ""),
          name: String(p.name || ""),
          updatedAt: String(p.updatedAt || ""),
        }))
        .filter((p) => p.id);
      return { at, projects };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function yieldToInput(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function rememberWritten(projects: NovelProject[]) {
  lastWrittenJson.clear();
  for (const p of projects) {
    lastWrittenJson.set(p.id, JSON.stringify(p));
    await yieldToInput();
  }
}

function writeLsProjectMeta(projects: NovelProject[]) {
  const mirror: ProjectsLsMirror = {
    at: new Date().toISOString(),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
    })),
  };
  lsSet(NEW_PROJECTS_LS, JSON.stringify(mirror));
}

async function readLegacyIdbArray(name: string): Promise<NovelProject[] | null> {
  const db = await openKv(name);
  const fromIdb = await idbGet<NovelProject[]>(db, IDB_STORE, "projects");
  if (Array.isArray(fromIdb) && fromIdb.length) {
    const list: NovelProject[] = [];
    for (const row of fromIdb) {
      list.push(normalizeProject(row));
      await yieldToInput();
    }
    return list;
  }
  return Array.isArray(fromIdb) ? fromIdb : null;
}

async function readIdbProjects(name: string): Promise<NovelProject[] | null> {
  const db = await openKv(name);
  const ids = await idbGet<string[]>(db, IDB_STORE, IDB_PROJECT_INDEX);
  if (Array.isArray(ids)) {
    const list: NovelProject[] = [];
    for (const id of ids) {
      const row = await idbGet<NovelProject>(db, IDB_STORE, projectIdbKey(id));
      if (row && typeof row === "object") list.push(normalizeProject(row));
      await yieldToInput();
    }
    return list;
  }
  const keys = await idbKeys(db, IDB_STORE);
  const projectKeys = keys
    .map(String)
    .filter((k) => k.startsWith(IDB_PROJECT_PREFIX));
  if (projectKeys.length) {
    const list: NovelProject[] = [];
    for (const key of projectKeys) {
      const row = await idbGet<NovelProject>(db, IDB_STORE, key);
      if (row && typeof row === "object") list.push(normalizeProject(row));
      await yieldToInput();
    }
    return list;
  }
  return readLegacyIdbArray(name);
}

async function migrateLegacyArrayToPerProject(
  projects: NovelProject[]
): Promise<void> {
  const db = await getNewDb();
  const existingSnap = await idbGet(db, IDB_STORE, IDB_MIGRATION_V3);
  if (!existingSnap) {
    await idbSet(
      db,
      IDB_STORE,
      { at: new Date().toISOString(), projects },
      IDB_MIGRATION_V3
    );
  }
  for (const p of projects) {
    await idbSet(db, IDB_STORE, p, projectIdbKey(p.id));
  }
  await idbSet(
    db,
    IDB_STORE,
    projects.map((p) => p.id),
    IDB_PROJECT_INDEX
  );
}

async function writeChangedProjects(projects: NovelProject[]): Promise<void> {
  const db = await getNewDb();
  const nextIds = new Set(projects.map((p) => p.id));
  for (const p of projects) {
    const json = JSON.stringify(p);
    if (lastWrittenJson.get(p.id) === json) continue;
    await idbSet(db, IDB_STORE, p, projectIdbKey(p.id));
    lastWrittenJson.set(p.id, json);
  }
  for (const id of [...lastWrittenJson.keys()]) {
    if (nextIds.has(id)) continue;
    await idbDelete(db, IDB_STORE, projectIdbKey(id));
    lastWrittenJson.delete(id);
  }
  await idbSet(
    db,
    IDB_STORE,
    projects.map((p) => p.id),
    IDB_PROJECT_INDEX
  );
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
  lastStorageWarning = null;
  lastWrittenJson.clear();
}

export function getLastStorageError(): unknown {
  return lastStorageError;
}

export function getLastStorageWarning(): string | null {
  return lastStorageWarning;
}

export function formatStorageError(err: unknown): string {
  if (!err) return "";
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === "QuotaExceededError" ||
    /quota|exceeded|5mb/i.test(msg)
  ) {
    return `本地镜像配额不足（约 5MB）：${msg}`;
  }
  return msg;
}

export function isFullBackupJson(json: string): boolean {
  try {
    const data = JSON.parse(json) as { projects?: unknown; id?: unknown };
    return Array.isArray(data.projects) && !data.id;
  } catch {
    return false;
  }
}

export function flushStorage(): Promise<void> {
  return persistChain;
}

/** 启动时：新 IDB →（仅当新库为空）旧 IDB/LS 只读迁入。不再创建旧库。 */
export async function initStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  if (storageReady) return storageReady;
  storageReady = (async () => {
    lastStorageWarning = null;
    try {
      const fromNew = await readIdbProjects(NEW_IDB_NAME);
      if (fromNew && fromNew.length) {
        const newDb = await getNewDb();
        const hasIndex = await idbGet<string[]>(newDb, IDB_STORE, IDB_PROJECT_INDEX);
        const hasLegacy = await idbGet<NovelProject[]>(newDb, IDB_STORE, "projects");
        if (!Array.isArray(hasIndex) && Array.isArray(hasLegacy)) {
          await migrateLegacyArrayToPerProject(fromNew);
        }
        if (!projectsCache) projectsCache = fromNew;
        await rememberWritten(fromNew);
        writeLsProjectMeta(fromNew);
        migrateLibrariesIfNeeded();
        void copyAutoBackupIfNeeded();
        return;
      }

      const fromOldIdb = (await oldIdbExists())
        ? await readLegacyIdbArray(OLD_IDB_NAME)
        : null;
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

      writeLsProjectMeta(projectsCache);
      if (projectsCache.length) {
        await migrateLegacyArrayToPerProject(projectsCache);
      } else {
        const db = await getNewDb();
        await idbSet(db, IDB_STORE, [], IDB_PROJECT_INDEX);
      }
      await rememberWritten(projectsCache);
      migrateLibrariesIfNeeded();
      void copyAutoBackupIfNeeded();
    } catch (e) {
      lastStorageError = e;
      const raw = lsReadNewThenOld(NEW_PROJECTS_LS, OLD_PROJECTS_LS);
      const full = parseProjectsJson(raw);
      const mirror = parseLsMirror(raw);
      if (full.length) {
        const days = daysSince(mirror?.at || "");
        lastStorageWarning =
          days != null
            ? `这是 ${days} 天前的降级快照，不是当前主库。请立刻下载完整备份并核对正文。`
            : "主库读取失败，已回退到本地镜像（时间未知）。请立刻下载完整备份。";
        if (!projectsCache) projectsCache = full;
      } else {
        lastStorageWarning =
          "主库读取失败，且本地没有可用的完整镜像。请导入备份。";
        if (!projectsCache) projectsCache = [];
      }
      migrateLibrariesIfNeeded();
    }
  })();
  return storageReady;
}

export function loadProjects(): NovelProject[] {
  // Cache is already normalized during init / save. Remapping every read
  // freezes the homepage after a long serial novel library loads.
  if (projectsCache) return projectsCache.slice();
  if (typeof window === "undefined") return [];
  return parseProjectsJson(
    lsReadNewThenOld(NEW_PROJECTS_LS, OLD_PROJECTS_LS)
  );
}

async function persistProjects(normalized: NovelProject[]): Promise<void> {
  lastStorageError = null;
  writeLsProjectMeta(normalized);
  await writeChangedProjects(normalized);
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
    lsSet(
      NEW_USAGE_STATS_KEY,
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
  const migrated = emptyLibraries();
  try {
    const oldTags = JSON.parse(lsGet(OLD_TAG_LIBRARY_KEY) || "null");
    if (Array.isArray(oldTags) && oldTags.length) {
      migrated.general.tags = cleanTagList(oldTags.map(String));
    }
  } catch {
    /* ignore */
  }
  try {
    const oldStyles = JSON.parse(lsGet(OLD_STYLE_LIBRARY_KEY) || "null");
    if (Array.isArray(oldStyles) && oldStyles.length) {
      migrated.general.styles = oldStyles.map((s: LearnedStyle) =>
        normalizeLearnedStyle(s)
      );
    }
  } catch {
    /* ignore */
  }
  saveLibraries(migrated);
}

async function copyAutoBackupIfNeeded() {
  try {
    const newDb = await getNewDb();
    const existing = await idbGet(newDb, IDB_STORE, "auto-backup");
    if (existing) return;
    if (!(await oldIdbExists())) return;
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
  lsSet(NEW_READER_PREFS_KEY, JSON.stringify(prefs));
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
  lsSet(NEW_USAGE_STATS_KEY, JSON.stringify(s));
  return s;
}

export function resetUsageStats(): UsageStats {
  const s = createEmptyUsageStats();
  lsSet(NEW_USAGE_STATS_KEY, JSON.stringify(s));
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
    lsSet(NEW_BACKUP_META_KEY, JSON.stringify({ lastAt: now }));
    void (async () => {
      const payload = {
        at: new Date().toISOString(),
        projects,
        tagLibrary: loadTagLibrary(),
        styleLibrary: loadStyleLibrary(),
        usageStats: loadUsageStats(),
      };
      try {
        const newDb = await getNewDb();
        await idbSet(newDb, IDB_STORE, payload, "auto-backup");
      } catch {
        /* ignore */
      }
      try {
        const desktop = getDesktop();
        if (desktop?.writeDesktopBackup) {
          await desktop.writeDesktopBackup({
            fileName: desktopBackupFileName(new Date(payload.at)),
            content: JSON.stringify(payload, null, 2),
          });
        }
      } catch {
        /* ignore */
      }
    })();
  } catch {
    /* ignore */
  }
}

export async function restoreFromAutoBackup(): Promise<{
  restored: number;
}> {
  const backup = await getAutoBackup();
  if (!backup?.projects?.length) {
    throw new Error("没有可恢复的自动备份");
  }
  const current = loadProjects();
  try {
    const db = await getNewDb();
    await idbSet(
      db,
      IDB_STORE,
      { at: new Date().toISOString(), projects: current },
      IDB_PRE_RESTORE
    );
  } catch {
    /* 快照失败不阻断恢复，但仍应尽量留下 */
  }
  saveProjects(backup.projects.map(normalizeProject));
  await flushStorage();
  return { restored: backup.projects.length };
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
    if (!(await oldIdbExists())) return null;
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
  return `fantawriter:project-tab:${projectId}`;
}

export function readProjectTab(projectId: string): string | null {
  return lsGet(projectTabKeyNew(projectId));
}

export function writeProjectTab(projectId: string, tab: string): void {
  lsSet(projectTabKeyNew(projectId), tab);
}
