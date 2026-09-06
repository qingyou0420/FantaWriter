/**
 * P0-5 source contract: 问心 is a full page, not a drawer.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const studioRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel: string): string {
  return readFileSync(join(studioRoot, rel), "utf8");
}

describe("ask page layout", () => {
  it("renders BookAskPage on book-ask and deletes the talk drawer stack", () => {
    const app = read("src/App.tsx");
    expect(app).not.toMatch(/book-talk-drawer/);
    expect(app).not.toMatch(/bookChatOpen/);
    expect(app).not.toMatch(/onToggleChat/);
    expect(app).not.toMatch(/\bchatOpen\b/);
    expect(app).not.toMatch(/closeAskDrawer/);
    expect(app).not.toMatch(/BookAskDrawerChrome/);
    expect(app).not.toMatch(/toBookChat/);
    expect(app).toMatch(/page === "book-ask"/);
    expect(app).toMatch(/BookAskPage/);
  });

  it("keeps ChatPage + story rail and does not mount BookSidebar", () => {
    const page = read("src/pages/BookAskPage.tsx");
    expect(page).toMatch(/mode="book"/);
    expect(page).toMatch(/ChatPage/);
    expect(page).toMatch(/AskStoryRail/);
    expect(page).toMatch(/active="ask"/);
    expect(page).not.toMatch(/BookSidebar/);
  });

  it("highlights chrome by route and keeps 书房 on the left", () => {
    const nav = read("src/components/BookWorkspaceNav.tsx");
    expect(nav).not.toMatch(/onToggleChat/);
    expect(nav).not.toMatch(/talkOpen/);
    expect(nav).toMatch(/justify-between/);
    expect(nav).toMatch(/nav\.toAsk\(bookId\)/);
  });

  it("strips book-page breadcrumbs and sends sidebar sessions to /ask", () => {
    const study = read("src/pages/BookStudy.tsx");
    const ground = read("src/pages/BookGround.tsx");
    const weave = read("src/pages/OutlineWorkspace.tsx");
    const write = read("src/pages/BookDetail.tsx");
    const sidebar = read("src/components/Sidebar.tsx");
    expect(study).not.toMatch(/bread\.books/);
    expect(ground).not.toMatch(/bread\.books/);
    expect(weave).not.toMatch(/bread\.books/);
    expect(write).not.toMatch(/bread\.books/);
    expect(sidebar).not.toMatch(/toBookChat/);
    expect(sidebar).toMatch(/nav\.toAsk/);
  });
});
