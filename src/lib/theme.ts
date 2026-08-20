import { resolveFlag } from "./flags";
import type { WritingBoard } from "./types";

export type AppTheme = "dark" | "light";

/** 旧键：M0–M3 双读双写 */
export const THEME_STORAGE_KEY = "h-novelist:theme";
export const APP_PREFS_KEY = "h-novelist:app-prefs";
export const THEME_STORAGE_KEY_NEW = "fantasy-writer:theme";
export const APP_PREFS_KEY_NEW = "fantasy-writer:app-prefs";

export const THEME_EVENT_OLD = "h-novelist-theme-change";
export const THEME_EVENT_NEW = "fantasy-writer-theme-change";

export interface AppPrefs {
  theme: AppTheme;
  /** 全书队列全部完成后自动跑人物一致性检查 */
  autoConsistencyAfterBookJob: boolean;
  schemaVersion?: 2;
  /** 全新安装首次询问前不得写入 */
  defaultBoard?: WritingBoard;
  /** ISO；每用户配置确认一次；有值则跳过 AgeGate */
  adultConfirmedAt?: string;
  flags?: Record<string, boolean>;
}

export const DEFAULT_APP_PREFS: AppPrefs = {
  theme: "dark",
  autoConsistencyAfterBookJob: false,
};

export function parseTheme(v: unknown): AppTheme {
  return v === "light" ? "light" : "dark";
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

export function loadAppPrefs(): AppPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_APP_PREFS };
  try {
    const raw = lsGet(APP_PREFS_KEY_NEW) ?? lsGet(APP_PREFS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<AppPrefs>;
      return {
        ...DEFAULT_APP_PREFS,
        ...data,
        theme: parseTheme(
          data.theme ??
            lsGet(THEME_STORAGE_KEY_NEW) ??
            lsGet(THEME_STORAGE_KEY)
        ),
      };
    }
    const t = lsGet(THEME_STORAGE_KEY_NEW) ?? lsGet(THEME_STORAGE_KEY);
    if (t) return { ...DEFAULT_APP_PREFS, theme: parseTheme(t) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_APP_PREFS };
}

function shouldDualWriteOld(prefs?: AppPrefs): boolean {
  return !resolveFlag(
    "brandRenameComplete",
    prefs ?? (typeof window === "undefined" ? DEFAULT_APP_PREFS : loadAppPrefs())
  );
}

export function saveAppPrefs(prefs: AppPrefs) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(prefs);
  lsSet(APP_PREFS_KEY_NEW, json);
  lsSet(THEME_STORAGE_KEY_NEW, prefs.theme);
  if (shouldDualWriteOld(prefs)) {
    lsSet(APP_PREFS_KEY, json);
    lsSet(THEME_STORAGE_KEY, prefs.theme);
  }
}

/** 应用到 <html data-theme> */
export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  lsSet(THEME_STORAGE_KEY_NEW, theme);
  if (shouldDualWriteOld()) {
    lsSet(THEME_STORAGE_KEY, theme);
  }
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return parseTheme(
      lsGet(THEME_STORAGE_KEY_NEW) ?? lsGet(THEME_STORAGE_KEY)
    );
  } catch {
    return "dark";
  }
}

export function dispatchThemeChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(THEME_EVENT_NEW));
  if (shouldDualWriteOld()) {
    window.dispatchEvent(new Event(THEME_EVENT_OLD));
  }
}

export function subscribeThemeChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", handler);
  window.addEventListener(THEME_EVENT_NEW, handler);
  window.addEventListener(THEME_EVENT_OLD, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(THEME_EVENT_NEW, handler);
    window.removeEventListener(THEME_EVENT_OLD, handler);
  };
}

/** 防闪烁：放在 <head> 内联执行。新键优先，回退旧键。 */
export const THEME_BOOT_SCRIPT = `(function(){try{var kn=${JSON.stringify(THEME_STORAGE_KEY_NEW)};var ko=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(kn)||localStorage.getItem(ko);if(t!=="light"&&t!=="dark"){var pn=${JSON.stringify(APP_PREFS_KEY_NEW)};var po=${JSON.stringify(APP_PREFS_KEY)};var p=localStorage.getItem(pn)||localStorage.getItem(po);if(p){try{t=JSON.parse(p).theme}catch(e){}}}if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
