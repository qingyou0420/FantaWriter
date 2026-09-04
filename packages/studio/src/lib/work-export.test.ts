import { describe, expect, it } from "vitest";
import {
  bookManuscriptExportPath,
  continueShortPrompt,
  manuscriptToPlainText,
  shortManuscriptExportPath,
} from "./work-export";
import { SIDEBAR_CREATE_ITEM_KEYS } from "./sidebar-create-items";

describe("manuscript export helpers", () => {
  it("builds book and short 原文 download paths", () => {
    expect(bookManuscriptExportPath("harbor")).toBe("/api/v1/books/harbor/export?format=txt");
    expect(bookManuscriptExportPath("harbor", "md", true)).toBe(
      "/api/v1/books/harbor/export?format=md&approvedOnly=true",
    );
    expect(shortManuscriptExportPath("明日来信")).toBe(
      `/api/v1/shorts/${encodeURIComponent("明日来信")}/export?format=txt`,
    );
    expect(shortManuscriptExportPath("elevator", "md")).toBe("/api/v1/shorts/elevator/export?format=md");
  });

  it("strips markdown chrome for 导出原文 txt", () => {
    expect(manuscriptToPlainText("# 标题\n\n**加粗** 和 *斜体*\n\n- 一句")).toBe("标题\n\n加粗 和 斜体\n\n一句");
  });

  it("keeps a continue-writing prompt that names the existing short", () => {
    expect(continueShortPrompt("电梯多一层", "elevator").zh).toContain("elevator");
    expect(continueShortPrompt("电梯多一层", "elevator").zh).toContain("电梯多一层");
  });
});

describe("sidebar create items", () => {
  it("only exposes long novel and short story", () => {
    expect([...SIDEBAR_CREATE_ITEM_KEYS]).toEqual(["nav.createNovel", "nav.createShort"]);
  });
});
