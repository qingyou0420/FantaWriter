import {
  DEFAULT_GENERAL_TAG_LIBRARY,
  DEFAULT_READER_PREFS,
  DEFAULT_TAG_LIBRARY,
  assertWritingBoardImmutable,
  createEmptyUsageStats,
  defaultContentRating,
  defaultVolumeId,
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
  erotic: BoardLibraries;
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
  if (prefs.defaultBoard) return;
  saveAppPrefs({ ...prefs, defaultBoard: "erotic" });
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

export const CONVERT_UNLOCK_TOKEN = "convertProjectWritingBoard" as const;

export type ConvertWritingBoardOpts = {
  unlockToken: typeof CONVERT_UNLOCK_TOKEN;
  title: string;
  inPlace?: boolean;
  keepGenreTags?: string[];
};

function cloneProject(p: NovelProject): NovelProject {
  return JSON.parse(JSON.stringify(p)) as NovelProject;
}

function remapVolumeIds(p: NovelProject, oldId: string): NovelProject {
  const map = new Map<string, string>();
  const volumes = (p.volumes || []).map((v, i) => {
    const nid =
      v.id === defaultVolumeId(oldId) || i === 0
        ? defaultVolumeId(p.id)
        : crypto.randomUUID();
    map.set(v.id, nid);
    return { ...v, id: nid };
  });
  const outline = p.outline
    ? {
        ...p.outline,
        chapters: p.outline.chapters.map((c) => ({
          ...c,
          volumeId: (c.volumeId && map.get(c.volumeId)) || defaultVolumeId(p.id),
        })),
      }
    : p.outline;
  return { ...p, volumes, outline };
}

function applyBoardConversion(
  clone: NovelProject,
  from: WritingBoard,
  to: WritingBoard,
  keepGenreTags?: string[]
): NovelProject {
  let next = { ...clone, writingBoard: to, contentRating: defaultContentRating(to) };
  if (from === "erotic" && to === "general") {
    next.archivedActTags = [...(clone.tags || [])];
    next.tags = [...(keepGenreTags || [])];
    const keepLearned = next.settings.writingStyle !== "learned";
    next.settings = {
      ...next.settings,
      learnedStyleId: "",
      learnedStyleGuide: "",
      learnedStyleName: "",
      writingStyle: keepLearned ? next.settings.writingStyle : "literary",
    };
  } else if (from === "general" && to === "erotic") {
    next.archivedActTags = [];
  }
  return next;
}

/** 存储层唯一允许改 writingBoard 的入口。默认另存为新书。 */
export function convertProjectWritingBoard(
  source: NovelProject,
  to: WritingBoard,
  opts: ConvertWritingBoardOpts
): NovelProject {
  if (opts.unlockToken !== CONVERT_UNLOCK_TOKEN) {
    throw new Error("WRITING_BOARD_LOCKED");
  }
  if (source.writingBoard === to) {
    throw new Error("ALREADY_ON_BOARD");
  }
  const title = opts.title.trim();
  if (!title) throw new Error("请填写转换后的书名");

  const now = new Date().toISOString();
  let clone = cloneProject(source);
  if (!opts.inPlace) {
    const oldId = clone.id;
    clone.id = crypto.randomUUID();
    clone.createdAt = now;
    clone = remapVolumeIds(clone, oldId);
  }
  clone.name = title;
  clone.updatedAt = now;
  clone.bookJob = null;
  clone = applyBoardConversion(
    clone,
    source.writingBoard,
    to,
    opts.keepGenreTags
  );
  clone = normalizeProject(clone);

  const list = loadProjects();
  if (opts.inPlace) {
    const idx = list.findIndex((p) => p.id === source.id);
    if (idx < 0) list.unshift(clone);
    else list[idx] = clone;
    saveProjects(list);
  } else {
    upsertProject(clone);
  }
  return clone;
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
    const merged = [...libs.erotic.tags];
    const seen = new Set(merged);
    for (const t of data.tagLibrary) {
      const s = String(t).trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        merged.push(s);
      }
    }
    libs.erotic.tags = merged;
  }
  if (Array.isArray(data.styleLibrary)) {
    const byId = new Map(libs.erotic.styles.map((s) => [s.id, s]));
    for (const s of data.styleLibrary) {
      const n = normalizeLearnedStyle(s);
      if (!byId.has(n.id)) {
        libs.erotic.styles.push(n);
        byId.set(n.id, n);
      }
    }
  }
  if (data.libraries) {
    /* 新格式：不覆盖已有书；库按桶合并，缺 writingBoard 的旧档案进 erotic */
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
    erotic: { tags: [...DEFAULT_TAG_LIBRARY], styles: [] },
  };
}

function parseLibraries(raw: string | null): StoredLibraries | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredLibraries>;
    if (!data || typeof data !== "object") return null;
    const base = emptyLibraries();
    if (data.general?.tags) base.general.tags = data.general.tags.map(String);
    if (data.general?.styles) {
      base.general.styles = data.general.styles.map(normalizeLearnedStyle);
    }
    if (data.erotic?.tags) base.erotic.tags = data.erotic.tags.map(String);
    if (data.erotic?.styles) {
      base.erotic.styles = data.erotic.styles.map(normalizeLearnedStyle);
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
  lsSet(NEW_LIBRARIES_KEY, JSON.stringify(libs));
  if (shouldDualWriteOld()) {
    lsSet(OLD_TAG_LIBRARY_KEY, JSON.stringify(libs.erotic.tags));
    lsSet(OLD_STYLE_LIBRARY_KEY, JSON.stringify(libs.erotic.styles));
  }
}

function migrateLibrariesIfNeeded() {
  if (typeof window === "undefined") return;
  if (lsGet(NEW_LIBRARIES_KEY)) return;
  let eroticTags: string[] = [...DEFAULT_TAG_LIBRARY];
  try {
    const raw = lsGet(OLD_TAG_LIBRARY_KEY);
    if (raw) {
      const data = JSON.parse(raw) as string[];
      if (Array.isArray(data) && data.length) {
        eroticTags = data.map((t) => String(t).trim()).filter(Boolean);
      }
    }
  } catch {
    /* keep default */
  }
  let eroticStyles: LearnedStyle[] = [];
  try {
    const raw = lsGet(OLD_STYLE_LIBRARY_KEY);
    if (raw) {
      const data = JSON.parse(raw) as LearnedStyle[];
      if (Array.isArray(data)) {
        eroticStyles = data.map(normalizeLearnedStyle);
      }
    }
  } catch {
    /* ignore */
  }
  saveLibraries({
    general: { tags: [...DEFAULT_GENERAL_TAG_LIBRARY], styles: [] },
    erotic: { tags: eroticTags, styles: eroticStyles },
  });
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

export function loadTagLibraryFor(board: WritingBoard): string[] {
  if (typeof window === "undefined") {
    return board === "general"
      ? [...DEFAULT_GENERAL_TAG_LIBRARY]
      : [...DEFAULT_TAG_LIBRARY];
  }
  migrateLibrariesIfNeeded();
  const libs = loadLibraries();
  const tags = board === "general" ? libs.general.tags : libs.erotic.tags;
  if (tags.length) return tags;
  return board === "general"
    ? [...DEFAULT_GENERAL_TAG_LIBRARY]
    : [...DEFAULT_TAG_LIBRARY];
}

/** 兼容旧调用：默认 erotic 桶 */
export function loadTagLibrary(): string[] {
  return loadTagLibraryFor("erotic");
}

export function saveTagLibraryFor(board: WritingBoard, tags: string[]): void {
  if (typeof window === "undefined") return;
  const clean = cleanTagList(tags);
  const libs = loadLibraries();
  if (board === "general") libs.general.tags = clean;
  else libs.erotic.tags = clean;
  saveLibraries(libs);
}

export function saveTagLibrary(tags: string[]): void {
  saveTagLibraryFor("erotic", tags);
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

export function resetTagLibraryToDefaultFor(board: WritingBoard): string[] {
  const initial =
    board === "general"
      ? [...DEFAULT_GENERAL_TAG_LIBRARY]
      : [...DEFAULT_TAG_LIBRARY];
  saveTagLibraryFor(board, initial);
  return initial;
}

export function resetTagLibraryToDefault(): string[] {
  return resetTagLibraryToDefaultFor("erotic");
}

export function loadStyleLibraryFor(board: WritingBoard): LearnedStyle[] {
  if (typeof window === "undefined") return [];
  migrateLibrariesIfNeeded();
  const libs = loadLibraries();
  const list = board === "general" ? libs.general.styles : libs.erotic.styles;
  return list
    .map(normalizeLearnedStyle)
    .filter((s) => s.writingBoard === board);
}

/** 兼容旧调用：默认 erotic 桶 */
export function loadStyleLibrary(): LearnedStyle[] {
  return loadStyleLibraryFor("erotic");
}

export function saveStyleLibraryFor(
  board: WritingBoard,
  styles: LearnedStyle[]
): void {
  if (typeof window === "undefined") return;
  const libs = loadLibraries();
  const next = styles.map((s) =>
    normalizeLearnedStyle({ ...s, writingBoard: board })
  );
  if (board === "general") libs.general.styles = next;
  else libs.erotic.styles = next;
  saveLibraries(libs);
}

export function saveStyleLibrary(styles: LearnedStyle[]): void {
  saveStyleLibraryFor("erotic", styles);
}

export function upsertLearnedStyle(style: LearnedStyle): LearnedStyle[] {
  const n = normalizeLearnedStyle(style);
  const list = loadStyleLibraryFor(n.writingBoard);
  const idx = list.findIndex((s) => s.id === n.id);
  if (idx >= 0) list[idx] = n;
  else list.unshift(n);
  saveStyleLibraryFor(n.writingBoard, list);
  return list;
}

export function deleteLearnedStyle(id: string): LearnedStyle[] {
  const libs = loadLibraries();
  const inGeneral = libs.general.styles.some((s) => s.id === id);
  const board: WritingBoard = inGeneral ? "general" : "erotic";
  const list = loadStyleLibraryFor(board).filter((s) => s.id !== id);
  saveStyleLibraryFor(board, list);
  return list;
}

export function getLearnedStyle(id: string): LearnedStyle | null {
  const libs = loadLibraries();
  const all = [...libs.general.styles, ...libs.erotic.styles].map(
    normalizeLearnedStyle
  );
  return all.find((s) => s.id === id) ?? null;
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
