import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SIDEBAR_CREATE_ITEM_KEYS } from "../lib/sidebar-create-items";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
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
    expect(createBlock).toMatch(/nav\.createNovel/);
    expect(createBlock).toMatch(/nav\.createShort/);
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
    expect(dashboard).toMatch(/short\.continue|short\.finished/);
    expect(dashboard).toMatch(/short\.settings/);
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
