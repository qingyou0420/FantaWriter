/** Visible entries in the Studio left-sidebar create block. Other modes stay implemented, just hidden. */
export const SIDEBAR_CREATE_ITEM_KEYS = ["nav.createNovel", "nav.createShort"] as const;

export type SidebarCreateItemKey = (typeof SIDEBAR_CREATE_ITEM_KEYS)[number];

/** Left-nav section order bound from 清游: create → works → sessions → tools → system. */
export const SIDEBAR_SECTION_ORDER = ["create", "works", "sessions", "tools", "system"] as const;

export type SidebarSectionId = (typeof SIDEBAR_SECTION_ORDER)[number];

/** Tools list: 文风学习 / 题材模板. Import, doctor, radar stay implemented but hidden. */
export const SIDEBAR_TOOL_ITEM_KEYS = ["nav.style", "nav.genreTemplates"] as const;

export type SidebarToolItemKey = (typeof SIDEBAR_TOOL_ITEM_KEYS)[number];

/** System settings: 模型配置 / 项目设置 / 检查更新 / 守护进程 / 日志记录. */
export const SIDEBAR_SYSTEM_ITEM_KEYS = [
  "nav.config",
  "nav.projectSettings",
  "nav.checkUpdate",
  "nav.daemon",
  "nav.logs",
] as const;

export type SidebarSystemItemKey = (typeof SIDEBAR_SYSTEM_ITEM_KEYS)[number];
