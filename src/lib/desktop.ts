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
  assetApiUrl?: string;
  sha256?: string;
  sha256DownloadUrl?: string;
  sha256AssetApiUrl?: string;
  source?: string;
  message: string;
  searchedDirs?: string[];
};

export type UpdateSettings = {
  hasGithubToken: boolean;
  tokenPrefix: string;
  repo: string;
};

export type DownloadUpdateResult = {
  ok: boolean;
  path?: string;
  version?: string;
  message: string;
};

export type PickDirectoryResult = {
  ok: boolean;
  path?: string;
  canceled?: boolean;
  message: string;
};

export type WriteTextFilesResult = {
  ok: boolean;
  written: string[];
  message: string;
};

export type DesktopBridge = {
  isDesktop: true;
  platform: string;
  getAppInfo: () => Promise<DesktopAppInfo>;
  getUpdateSettings?: () => Promise<UpdateSettings>;
  setGithubUpdateToken?: (token: string) => Promise<{ ok: boolean; hasGithubToken: boolean }>;
  checkUpdate: () => Promise<UpdateCheckResult>;
  downloadUpdate?: (
    opts: {
      downloadUrl?: string;
      assetApiUrl?: string;
      version?: string;
      sha256?: string;
      sha256DownloadUrl?: string;
      sha256AssetApiUrl?: string;
    } | string
  ) => Promise<DownloadUpdateResult>;
  installUpdate: (installerPath: string) => Promise<{ ok: boolean; message: string }>;
  pickInstaller: () => Promise<{ ok: boolean; path?: string; version?: string; message: string }>;
  openPath: (target: string) => Promise<{ ok: boolean; message?: string }>;
  openUpdateDir: () => Promise<{ ok: boolean; path: string; message?: string }>;
  pickDirectory?: (opts?: {
    title?: string;
    defaultPath?: string;
  }) => Promise<PickDirectoryResult>;
  writeTextFiles?: (payload: {
    root: string;
    files: { relativePath: string; content: string }[];
  }) => Promise<WriteTextFilesResult>;
  writeDesktopBackup?: (payload: {
    fileName: string;
    content: string;
  }) => Promise<{ ok: boolean; path?: string; kept?: string[]; message: string }>;
  openBackupDir?: () => Promise<{ ok: boolean; path?: string; message?: string }>;
  getSuggestedExportRoot?: () => Promise<{
    ok: boolean;
    path: string;
    message?: string;
  }>;
};

declare global {
  interface Window {
    fantasyWriter?: DesktopBridge;
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.fantasyWriter?.isDesktop);
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.fantasyWriter ?? null;
}
