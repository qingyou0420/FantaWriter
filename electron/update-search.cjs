/**
 * Where the desktop shell looks for FantaWriter-Setup-*.exe.
 * Silent startup checks must not readdir() 桌面 / 下载 / 文档 — those folders
 * can be huge, and a sync walk freezes the Electron main process (homepage
 * inputs look alive but ignore clicks until the scan finishes).
 */

/** Keys that may point at large user home folders. */
const BULK_USER_DIR_KEYS = ["desktop", "downloads", "documents"];

const SILENT_DIR_KEYS = [
  "env",
  "exeUpdates",
  "userDataUpdates",
  "desktopUpdatesFolder",
  "exeDir",
  "devDist",
];

const MANUAL_DIR_KEYS = [...SILENT_DIR_KEYS, ...BULK_USER_DIR_KEYS];

/**
 * @param {unknown} payload
 * @returns {{ silent: boolean, kind: "silent" | "manual" }}
 */
function parseCheckUpdateRequest(payload) {
  const silent = Boolean(
    payload && typeof payload === "object" && payload.silent === true
  );
  return { silent, kind: silent ? "silent" : "manual" };
}

/**
 * @param {string[]} out
 * @param {unknown} d
 */
function pushDir(out, d) {
  if (Array.isArray(d)) {
    for (const item of d) pushDir(out, item);
    return;
  }
  if (typeof d === "string") {
    const trimmed = d.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
}

/**
 * @param {"silent" | "manual"} kind
 * @param {Record<string, string | string[] | undefined | null>} paths
 * @returns {string[]}
 */
function collectUpdateSearchDirs(kind, paths) {
  const keys = kind === "silent" ? SILENT_DIR_KEYS : MANUAL_DIR_KEYS;
  const src = paths && typeof paths === "object" ? paths : {};
  /** @type {string[]} */
  const out = [];
  for (const key of keys) {
    pushDir(out, src[key]);
  }
  return out;
}

module.exports = {
  BULK_USER_DIR_KEYS,
  SILENT_DIR_KEYS,
  MANUAL_DIR_KEYS,
  parseCheckUpdateRequest,
  collectUpdateSearchDirs,
};
