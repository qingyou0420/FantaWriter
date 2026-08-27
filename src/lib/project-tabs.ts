export type ProjectTab =
  | "original"
  | "premise"
  | "characters"
  | "background"
  | "settings"
  | "volumes"
  | "lore"
  | "outline"
  | "chapters"
  | "plot"
  | "tools";

export type StageId = "setup" | "write" | "review";

const ALL_TABS: ProjectTab[] = [
  "original",
  "premise",
  "characters",
  "background",
  "settings",
  "volumes",
  "lore",
  "outline",
  "chapters",
  "plot",
  "tools",
];

/** 已删除的 tab 名回退到合理页 */
const LEGACY_TAB: Record<string, ProjectTab> = {
  progress: "tools",
  tags: "settings",
};

export function isProjectTab(id: string): id is ProjectTab {
  return ALL_TABS.includes(id as ProjectTab);
}

export function resolveProjectTab(
  raw: string | null | undefined
): ProjectTab {
  const mapped = raw ? LEGACY_TAB[raw] || raw : "";
  return isProjectTab(mapped) ? mapped : "characters";
}

export function stageOf(tab: ProjectTab): StageId {
  if (tab === "outline" || tab === "chapters") return "write";
  if (tab === "plot" || tab === "tools") return "review";
  return "setup";
}

export function setupTabs(hasOriginal: boolean): ProjectTab[] {
  const tabs: ProjectTab[] = [];
  if (hasOriginal) tabs.push("original");
  tabs.push("premise", "characters", "background", "lore", "volumes", "settings");
  return tabs;
}
