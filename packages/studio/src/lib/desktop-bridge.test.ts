import { describe, expect, it } from "vitest";
import { readDesktopBridge, updateActionsFromCheck } from "./desktop-bridge";

function fakeBridge() {
  return {
    checkUpdate: async () => ({ ok: true, hasUpdate: false }),
    downloadUpdate: async () => ({ ok: true }),
    installUpdate: async () => ({ ok: true }),
  };
}

describe("readDesktopBridge", () => {
  it("reads window.fantaWriter and ignores the old window.fw name", () => {
    expect(readDesktopBridge({})).toBeNull();
    expect(readDesktopBridge({ fw: fakeBridge() })).toBeNull();
    expect(readDesktopBridge({ fantaWriter: {} })).toBeNull();
    const api = fakeBridge();
    expect(readDesktopBridge({ fantaWriter: api })).toBe(api);
    expect(readDesktopBridge({ fantasyWriter: api })).toBe(api);
  });
});

describe("updateActionsFromCheck", () => {
  it("enables 下载 only when a newer GitHub asset is present", () => {
    expect(updateActionsFromCheck(null)).toEqual({
      canDownload: false,
      canInstall: false,
      installerPath: "",
    });
    expect(updateActionsFromCheck({
      hasUpdate: true,
      downloadUrl: "https://github.com/qingyou0420/FantaWriter/releases/download/v2.0.1/FantaWriter-Setup-2.0.1.exe",
    }).canDownload).toBe(true);
    expect(updateActionsFromCheck({
      hasUpdate: false,
      downloadUrl: "https://github.com/qingyou0420/FantaWriter/releases/download/v2.0.1/FantaWriter-Setup-2.0.1.exe",
    }).canDownload).toBe(false);
  });

  it("enables 安装并重启 from a local installer path without hitting GitHub", () => {
    const next = updateActionsFromCheck({
      hasUpdate: true,
      installerPath: "C:\\\\Users\\\\me\\\\FantaWriter-Setup-2.0.1.exe",
    });
    expect(next.canDownload).toBe(false);
    expect(next.canInstall).toBe(true);
    expect(next.installerPath).toContain("FantaWriter-Setup-2.0.1.exe");
  });
});
