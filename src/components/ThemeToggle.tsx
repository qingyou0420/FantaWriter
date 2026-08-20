"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  applyTheme,
  dispatchThemeChange,
  getStoredTheme,
  loadAppPrefs,
  saveAppPrefs,
  subscribeThemeChange,
  type AppTheme,
} from "@/lib/theme";

function subscribe(onStoreChange: () => void) {
  return subscribeThemeChange(onStoreChange);
}

function getClientTheme(): AppTheme {
  return getStoredTheme();
}

function getServerTheme(): AppTheme {
  return "dark";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribe,
    getClientTheme,
    getServerTheme
  );

  const toggle = useCallback(() => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    const prefs = loadAppPrefs();
    saveAppPrefs({ ...prefs, theme: next });
    if (typeof window !== "undefined") {
      dispatchThemeChange();
    }
  }, [theme]);

  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm ${className}`}
      onClick={toggle}
      title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
    >
      {theme === "dark" ? (
        <>
          <span aria-hidden>☀</span> 浅色
        </>
      ) : (
        <>
          <span aria-hidden>☾</span> 深色
        </>
      )}
    </button>
  );
}
