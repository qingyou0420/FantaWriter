import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

describe("studio in-app update chrome", () => {
  it("exposes 检查更新 in the 系统 sidebar next to 项目设置", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    expect(sidebar).toMatch(/nav\.checkUpdate/);
    expect(sidebar).toMatch(/toCheckUpdate/);
    expect(sidebar).toMatch(/activePage === "update"/);
    expect(sidebar.indexOf("nav.projectSettings")).toBeLessThan(sidebar.indexOf("nav.checkUpdate"));
    expect(sidebar.indexOf("nav.checkUpdate")).toBeLessThan(sidebar.indexOf("nav.daemon"));
    expect(sidebar).not.toMatch(/window\.fw[^a-zA-Z]/);
  });

  it("ships a CheckUpdate page that uses the desktop preload bridge", () => {
    expect(existsSync(join(studioRoot, "src/pages/CheckUpdate.tsx"))).toBe(true);
    expect(existsSync(join(studioRoot, "src/lib/desktop-bridge.ts"))).toBe(true);

    const page = read("src/pages/CheckUpdate.tsx");
    const app = read("src/App.tsx");
    const i18n = read("src/hooks/use-i18n.ts");
    const hash = read("src/hooks/use-hash-route.ts");
    const bridge = read("src/lib/desktop-bridge.ts");

    expect(page).toMatch(/检查更新|update\.check/);
    expect(page).toMatch(/update\.download/);
    expect(page).toMatch(/update\.install/);
    expect(page).toMatch(/getDesktopBridge/);
    expect(page).not.toMatch(/window\.fw\b/);
    expect(page).not.toMatch(/IndexedDB|fantawriter/);

    expect(app).toMatch(/CheckUpdate/);
    expect(app).toMatch(/page === "update"/);
    expect(app).toMatch(/toCheckUpdate/);

    expect(i18n).toMatch(/"nav.checkUpdate": \{ zh: "检查更新"/);
    expect(i18n).toMatch(/zh: "安装并重启"/);
    expect(i18n).toMatch(/zh: "发现新版本"/);

    expect(hash).toMatch(/page: "update"/);
    expect(hash).toMatch(/#\/update/);

    expect(bridge).toMatch(/window\.fantaWriter/);
    expect(bridge).toMatch(/checkUpdate/);
    expect(bridge).not.toMatch(/window\.fw\b/);
  });
});
