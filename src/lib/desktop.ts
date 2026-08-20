/** 桌面端（Electron）桥接类型与安全调用 */

export type DesktopAppInfo = {
  version: string;
  isDesktop: boolean;
  isPackaged: boolean;
  platform: string;
  updateDir: string;
  exeDir: string;
};

export type UpdateCheckResult = {
  ok: boolean;
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  installerPath?: string;
  downloadUrl?: string;
  source?: string;
  message: string;
  searchedDirs?: string[];
};

export type DesktopBridge = {
  isDesktop: true;
  platform: string;
  getAppInfo: () => Promise<DesktopAppInfo>;
  checkUpdate: () => Promise<UpdateCheckResult>;
  installUpdate: (installerPath: string) => Promise<{ ok: boolean; message: string }>;
  pickInstaller: () => Promise<{ ok: boolean; path?: string; version?: string; message: string }>;
  openPath: (target: string) => Promise<{ ok: boolean; message?: string }>;
  openUpdateDir: () => Promise<{ ok: boolean; path: string; message?: string }>;
};

declare global {
  interface Window {
    eroticNovelStudio?: DesktopBridge;
    fantasyWriter?: DesktopBridge;
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.fantasyWriter?.isDesktop || window.eroticNovelStudio?.isDesktop
  );
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.fantasyWriter ?? window.eroticNovelStudio ?? null;
}
