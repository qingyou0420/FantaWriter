import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SIDEBAR_CREATE_ITEM_KEYS,
  SIDEBAR_SECTION_ORDER,
  SIDEBAR_SYSTEM_ITEM_KEYS,
  SIDEBAR_TOOL_ITEM_KEYS,
} from "../lib/sidebar-create-items";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

function sectionIndex(source: string, marker: string): number {
  const index = source.indexOf(marker);
  expect(index).toBeGreaterThan(-1);
  return index;
}

describe("sidebar create block", () => {
  it("temporarily keeps only 长篇小说 and 短篇小说", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    const createBlock = sidebar.slice(
      sidebar.indexOf("nav.createSection"),
      sidebar.indexOf("nav.myBooks"),
    );

    expect(SIDEBAR_CREATE_ITEM_KEYS).toEqual(["nav.createNovel", "nav.createShort"]);
    expect(createBlock).toMatch(/sidebar-create-list/);
    expect(createBlock).toMatch(/SIDEBAR_CREATE_ITEM_KEYS/);
    expect(createBlock).toMatch(/sidebar-create-novel/);
    expect(createBlock).toMatch(/sidebar-create-short/);
    expect(createBlock).toMatch(/nav\.createNovel/);
    expect(createBlock).not.toMatch(/nav\.createScript/);
    expect(createBlock).not.toMatch(/nav\.createStoryboard/);
    expect(createBlock).not.toMatch(/nav\.createInteractiveFilm/);
    expect(createBlock).not.toMatch(/nav\.createFanfic/);
    expect(createBlock).not.toMatch(/nav\.createSpinoff/);
    expect(createBlock).not.toMatch(/nav\.createImitation/);
    expect(createBlock).not.toMatch(/nav\.createContinuation/);
    expect(createBlock).not.toMatch(/nav\.createTranslation/);
    expect(createBlock).not.toMatch(/nav\.createBranching/);
    expect(createBlock).not.toMatch(/nav\.createFree/);
  });

  it("renders left-nav sections in 清游 order with the bound items", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    const i18n = read("src/hooks/use-i18n.ts");

    expect([...SIDEBAR_SECTION_ORDER]).toEqual(["create", "works", "sessions", "tools", "system"]);
    expect([...SIDEBAR_TOOL_ITEM_KEYS]).toEqual(["nav.style", "nav.genreTemplates"]);
    expect([...SIDEBAR_SYSTEM_ITEM_KEYS]).toEqual([
      "nav.config",
      "nav.projectSettings",
      "nav.checkUpdate",
      "nav.daemon",
      "nav.logs",
    ]);

    const create = sectionIndex(sidebar, "nav.createSection");
    const works = sectionIndex(sidebar, "nav.myBooks");
    const sessions = sectionIndex(sidebar, "nav.history");
    const tools = sectionIndex(sidebar, "nav.tools");
    const system = sectionIndex(sidebar, "nav.system");
    expect(create).toBeLessThan(works);
    expect(works).toBeLessThan(sessions);
    expect(sessions).toBeLessThan(tools);
    expect(tools).toBeLessThan(system);

    expect(i18n).toMatch(/"nav\.createSection": \{ zh: "开始创作"/);
    expect(i18n).toMatch(/"nav\.myBooks": \{ zh: "我的创作"/);
    expect(i18n).toMatch(/"nav\.history": \{ zh: "会话记录"/);
    expect(i18n).toMatch(/"nav\.tools": \{ zh: "工具列表"/);
    expect(i18n).toMatch(/"nav\.system": \{ zh: "系统设置"/);
    expect(i18n).toMatch(/"nav\.style": \{ zh: "文风学习"/);
    expect(i18n).toMatch(/"nav\.genreTemplates": \{ zh: "题材模板"/);
    expect(i18n).toMatch(/"nav\.logs": \{ zh: "日志记录"/);
  });

  it("hides film leftovers, import, and doctor from the left menu without deleting the features", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    const toolsBlock = sidebar.slice(sidebar.indexOf("nav.tools"), sidebar.indexOf("nav.system"));
    const systemBlock = sidebar.slice(sidebar.indexOf("nav.system"), sidebar.indexOf("nav.agentOnline"));

    expect(sidebar).not.toMatch(/film-projects-section/);
    expect(sidebar).not.toMatch(/nav\.createInteractiveFilm/);
    expect(sidebar).not.toMatch(/refetchFilms/);
    expect(existsSync(join(studioRoot, "src/pages/FilmWizard.tsx"))).toBe(true);
    expect(existsSync(join(studioRoot, "src/pages/ImportManager.tsx"))).toBe(true);
    expect(existsSync(join(studioRoot, "src/pages/DoctorView.tsx"))).toBe(true);
    expect(existsSync(join(studioRoot, "src/pages/TranslationManager.tsx"))).toBe(true);
    expect(existsSync(join(studioRoot, "src/pages/RadarView.tsx"))).toBe(true);

    expect(toolsBlock).toMatch(/nav\.style/);
    expect(toolsBlock).toMatch(/nav\.genreTemplates/);
    expect(toolsBlock).not.toMatch(/nav\.import/);
    expect(toolsBlock).not.toMatch(/nav\.doctor/);
    expect(toolsBlock).not.toMatch(/nav\.translation/);
    expect(toolsBlock).not.toMatch(/nav\.radar/);

    expect(systemBlock).toMatch(/nav\.config/);
    expect(systemBlock).toMatch(/nav\.projectSettings/);
    expect(systemBlock).toMatch(/nav\.checkUpdate/);
    expect(systemBlock).toMatch(/nav\.daemon/);
    expect(systemBlock).toMatch(/nav\.logs/);
    expect(systemBlock).not.toMatch(/create\.genre/);
    expect(systemBlock).not.toMatch(/nav\.genreTemplates/);
  });

  it("opens 我的创作 works as manuscript body, not the cockpit or chat", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    expect(sidebar).toMatch(/nav\.toBookSettings\(bookId\)/);
    expect(sidebar).toMatch(/nav\.toShort\(short\.id\)/);
    const openBook = sidebar.slice(sidebar.indexOf("const openBook"), sidebar.indexOf("const sessionsByBook"));
    expect(openBook).toMatch(/toBookSettings/);
    expect(openBook).not.toMatch(/toBookChat/);
    expect(openBook).not.toMatch(/nav\.toBook\(/);
  });
});

describe("works list long/short parity", () => {
  it("labels longs as 长篇 and shorts as 短篇 on dashboard and sidebar", () => {
    const dashboard = read("src/pages/Dashboard.tsx");
    const sidebar = read("src/components/Sidebar.tsx");
    const i18n = read("src/hooks/use-i18n.ts");

    expect(i18n).toMatch(/"book\.badgeLong": \{ zh: "长篇"/);
    expect(i18n).toMatch(/"short\.badge": \{ zh: "短篇"/);
    expect(dashboard).toMatch(/book\.badgeLong/);
    expect(dashboard).toMatch(/short\.badge/);
    expect(dashboard).toMatch(/dashboard-book-badge-/);
    expect(dashboard).toMatch(/dashboard-short-badge-/);
    expect(sidebar).toMatch(/book\.badgeLong/);
    expect(sidebar).toMatch(/short\.badge/);
  });

  it("gives shorts the same card actions as books", () => {
    const dashboard = read("src/pages/Dashboard.tsx");
    expect(dashboard).toMatch(/short-continue-/);
    expect(dashboard).toMatch(/short-stats-/);
    expect(dashboard).toMatch(/short-settings-/);
    expect(dashboard).toMatch(/short-export-manuscript-/);
    expect(dashboard).toMatch(/short-delete-/);
    expect(dashboard).toMatch(/short\.finished|dash\.writeNext/);
    expect(dashboard).toMatch(/book\.settings/);
    expect(dashboard).toMatch(/book\.export/);
    expect(dashboard).toMatch(/shortManuscriptExportPath/);
    expect(dashboard).not.toMatch(/\/books\/\$\{short/);
  });

  it("labels export as 导出原文 for books and shorts", () => {
    const i18n = read("src/hooks/use-i18n.ts");
    const dashboard = read("src/pages/Dashboard.tsx");
    const bookDetail = read("src/pages/BookDetail.tsx");

    expect(i18n).toMatch(/"book\.export": \{ zh: "导出原文"/);
    expect(i18n).toMatch(/"book\.exportSave": \{ zh: "保存原文到项目"/);
    expect(dashboard).toMatch(/bookManuscriptExportPath/);
    expect(dashboard).toMatch(/shortManuscriptExportPath/);
    expect(bookDetail).toMatch(/book-export-manuscript/);
    expect(bookDetail).toMatch(/book\.exportSave/);
  });
});

describe("works list delete refresh", () => {
  it("drops a deleted short like 明日来信 from sidebar and dashboard via short DELETE", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    const dashboard = read("src/pages/Dashboard.tsx");

    expect(sidebar).toMatch(/deleteStudioShortWork/);
    expect(sidebar).toMatch(/removeShortFromCollection/);
    expect(sidebar).toMatch(/applyShortCollectionEvent/);
    expect(sidebar).toMatch(/selectWorksListShorts/);
    expect(sidebar).toMatch(/handleDeleteShortConfirm/);
    expect(sidebar).not.toMatch(/short_fiction_created/);

    expect(dashboard).toMatch(/deleteStudioShortWork/);
    expect(dashboard).toMatch(/selectWorksListShorts/);
    expect(dashboard).toMatch(/removeShortFromCollection/);
    expect(dashboard).not.toMatch(/\/books\/\$\{short/);
    expect(dashboard).not.toMatch(/\/books\/\$\{encodeURIComponent\(short/);
  });

  it("drops a deleted book from sidebar and dashboard lists immediately", () => {
    const sidebar = read("src/components/Sidebar.tsx");
    const dashboard = read("src/pages/Dashboard.tsx");
    const bookDetail = read("src/pages/BookDetail.tsx");

    expect(sidebar).toMatch(/removeBookFromCollection/);
    expect(sidebar).toMatch(/handleDeleteBookConfirm/);
    expect(sidebar).toMatch(/bumpBookDataVersion/);
    expect(sidebar).toMatch(/method: "DELETE"/);
    expect(sidebar).toMatch(/refetchBooks/);
    expect(sidebar).toMatch(/sidebar-book-delete-/);

    expect(dashboard).toMatch(/removeBookFromCollection/);
    expect(dashboard).toMatch(/bumpBookDataVersion/);
    expect(dashboard).toMatch(/method: "DELETE"/);

    expect(bookDetail).toMatch(/method: "DELETE"/);
    expect(bookDetail).toMatch(/bumpBookDataVersion/);
    expect(bookDetail).not.toMatch(/fetch\(`\/api\/v1\/books/);
  });
});
