import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_PREFS_KEY,
  APP_PREFS_KEY_NEW,
  THEME_STORAGE_KEY,
  THEME_STORAGE_KEY_NEW,
  loadAppPrefs,
  saveAppPrefs,
} from "./theme";

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

describe("AppPrefs dual keys", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads old h-novelist keys when new keys are empty", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    localStorage.setItem(
      APP_PREFS_KEY,
      JSON.stringify({ theme: "light", autoConsistencyAfterBookJob: true })
    );
    const prefs = loadAppPrefs();
    expect(prefs.theme).toBe("light");
    expect(prefs.autoConsistencyAfterBookJob).toBe(true);
  });

  it("writes new keys only after brand rename; still reads old keys", () => {
    saveAppPrefs({
      theme: "light",
      autoConsistencyAfterBookJob: false,
      defaultBoard: "erotic",
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY_NEW)).toBe("light");
    expect(localStorage.getItem(APP_PREFS_KEY_NEW)).toContain("erotic");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(APP_PREFS_KEY)).toBeNull();
  });
});
