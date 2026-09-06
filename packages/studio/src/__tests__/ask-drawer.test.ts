/**
 * R6 source contract: the ask drawer is chat-only (no BookSidebar).
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

function drawerSource(app: string): string {
  const start = app.indexOf("data-testid=\"book-talk-drawer\"");
  expect(start).toBeGreaterThan(-1);
  const asideStart = app.lastIndexOf("<aside", start);
  const asideEnd = app.indexOf("</aside>", start);
  expect(asideStart).toBeGreaterThan(-1);
  expect(asideEnd).toBeGreaterThan(asideStart);
  return app.slice(asideStart, asideEnd);
}

describe("ask drawer layout", () => {
  it("keeps ChatPage + story chrome and does not mount BookSidebar", () => {
    const app = read("src/App.tsx");
    const drawer = drawerSource(app);

    expect(app).not.toMatch(/from ["'].*BookSidebar["']/);
    expect(app).not.toMatch(/<BookSidebar[\s>]/);
    expect(app).not.toMatch(/<BookSidebarToggle[\s>]/);
    expect(drawer).not.toMatch(/BookSidebar/);
    expect(drawer).toMatch(/BookAskDrawerChrome/);
    expect(drawer).toMatch(/mode="book"/);
    expect(drawer).toMatch(/ChatPage/);
  });

  it("clears /chat hash when the drawer closes", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/closeAskDrawer/);
    expect(app).toMatch(/setRoute\(\{ page: "book", bookId: route\.bookId \}\)/);
    expect(app).toMatch(/onClick=\{closeAskDrawer\}/);
  });
});
