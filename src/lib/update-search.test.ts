import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  BULK_USER_DIR_KEYS,
  SILENT_DIR_KEYS,
  parseCheckUpdateRequest,
  shouldUseRemoteUpdateCheck,
  collectUpdateSearchDirs,
} = require("../../electron/update-search.cjs") as {
  BULK_USER_DIR_KEYS: string[];
  SILENT_DIR_KEYS: string[];
  parseCheckUpdateRequest: (payload: unknown) => {
    silent: boolean;
    kind: "silent" | "manual";
  };
  shouldUseRemoteUpdateCheck: (kind: "silent" | "manual") => boolean;
  collectUpdateSearchDirs: (
    kind: "silent" | "manual",
    paths: Record<string, string | string[]>
  ) => string[];
};

const PATHS = {
  env: "/custom/updates",
  exeUpdates: "/app/updates",
  userDataUpdates: "/data/updates",
  desktopUpdatesFolder: [
    "/Users/me/Desktop/FantaWriter-Updates",
    "/Users/me/Desktop/Fantasy-Writer-Updates",
  ],
  exeDir: "/app",
  devDist: "/src/dist-installer",
  desktop: "/Users/me/Desktop",
  downloads: "/Users/me/Downloads",
  documents: "/Users/me/Documents",
};

describe("parseCheckUpdateRequest", () => {
  it("defaults to a manual (full) scan", () => {
    expect(parseCheckUpdateRequest(undefined)).toEqual({
      silent: false,
      kind: "manual",
    });
    expect(parseCheckUpdateRequest({})).toEqual({
      silent: false,
      kind: "manual",
    });
  });

  it("treats { silent: true } as a bounded startup check", () => {
    expect(parseCheckUpdateRequest({ silent: true })).toEqual({
      silent: true,
      kind: "silent",
    });
  });
});

describe("shouldUseRemoteUpdateCheck", () => {
  it("skips GitHub / feed on silent startup", () => {
    expect(shouldUseRemoteUpdateCheck("silent")).toBe(false);
    expect(shouldUseRemoteUpdateCheck("manual")).toBe(true);
  });
});

describe("collectUpdateSearchDirs", () => {
  it("does not scan 桌面 / 下载 / 文档 / 安装目录 on silent startup", () => {
    const dirs = collectUpdateSearchDirs("silent", PATHS);
    expect(dirs).toEqual([
      PATHS.env,
      PATHS.exeUpdates,
      PATHS.userDataUpdates,
      ...PATHS.desktopUpdatesFolder,
    ]);
    for (const key of BULK_USER_DIR_KEYS) {
      expect(dirs).not.toContain(PATHS[key as keyof typeof PATHS]);
    }
    expect(dirs).not.toContain(PATHS.exeDir);
    expect(dirs).not.toContain(PATHS.devDist);
    expect(SILENT_DIR_KEYS).not.toContain("exeDir");
    expect(SILENT_DIR_KEYS).not.toContain("devDist");
  });

  it("still scans those folders on a manual check", () => {
    const dirs = collectUpdateSearchDirs("manual", PATHS);
    expect(dirs).toContain(PATHS.desktop);
    expect(dirs).toContain(PATHS.downloads);
    expect(dirs).toContain(PATHS.documents);
    expect(dirs).toContain(PATHS.exeDir);
    expect(dirs[0]).toBe(PATHS.env);
  });
});
