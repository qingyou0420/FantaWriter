import type { AppPrefs } from "./theme";

const MILESTONE_DEFAULTS: Record<string, boolean> = {
  dualBoard: true,
  modeScopedPrompts: true,
  libraryNamespaces: true,
  volumesUi: true,
  loreUi: true,
  promptWorkshop: true,
  brandRenameComplete: true,
  debugLastAssemble: false,
};

/** 环境变量 FW_FLAG_* > AppPrefs.flags > 里程碑默认 */
export function resolveFlag(name: string, prefs: AppPrefs): boolean {
  const envKey = `FW_FLAG_${name}`;
  const env =
    process.env[envKey] ?? process.env[`FW_FLAG_${name.toUpperCase()}`];
  if (env === "1" || env === "true") return true;
  if (env === "0" || env === "false") return false;
  if (prefs.flags && name in prefs.flags) return Boolean(prefs.flags[name]);
  return MILESTONE_DEFAULTS[name] ?? false;
}
