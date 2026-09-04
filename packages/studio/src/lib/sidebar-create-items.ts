/** Visible entries in the Studio left-sidebar create block. Other modes stay implemented, just hidden. */
export const SIDEBAR_CREATE_ITEM_KEYS = ["nav.createNovel", "nav.createShort"] as const;

export type SidebarCreateItemKey = (typeof SIDEBAR_CREATE_ITEM_KEYS)[number];
