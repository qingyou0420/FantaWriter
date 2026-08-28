export type StudioWorkspace =
  | "overview"
  | "outline"
  | "manuscript"
  | "review"
  | "library"
  | "sessions"
  | "tools";

/** @deprecated 旧三段式；只作兼容别名 */
export type StageId = "setup" | "write" | "review";

/** 历史 tab id，映射到工作区后不再作为主导航 */
export type ProjectTab = StudioWorkspace;

export type LibrarySection =
  | "intent"
  | "focus"
  | "foundation"
  | "characters"
  | "world"
  | "threads";

export type ToolsSection =
  | "tools"
  | "settings"
  | "tags"
  | "jobs"
  | "migrate"
  | "styles";

const ALL_WORKSPACES: StudioWorkspace[] = [
  "overview",
  "outline",
  "manuscript",
  "review",
  "library",
  "sessions",
  "tools",
];

export const STUDIO_NAV: { id: StudioWorkspace; label: string }[] = [
  { id: "overview", label: "总览" },
  { id: "outline", label: "大纲" },
  { id: "manuscript", label: "正文" },
  { id: "review", label: "审稿" },
  { id: "library", label: "资料库" },
  { id: "sessions", label: "AI 协作" },
  { id: "tools", label: "工具与设置" },
];

/** 已删除或降级的 tab 名回退到工作区 */
const LEGACY_TAB: Record<string, StudioWorkspace> = {
  progress: "tools",
  tags: "tools",
  settings: "tools",
  original: "tools",
  premise: "library",
  characters: "library",
  background: "library",
  lore: "library",
  plot: "library",
  volumes: "outline",
  outline: "outline",
  chapters: "manuscript",
  tools: "tools",
  setup: "library",
  write: "manuscript",
  review: "review",
};

export function isStudioWorkspace(id: string): id is StudioWorkspace {
  return ALL_WORKSPACES.includes(id as StudioWorkspace);
}

export function isProjectTab(id: string): id is ProjectTab {
  return isStudioWorkspace(id) || id in LEGACY_TAB;
}

export function resolveStudioWorkspace(
  raw: string | null | undefined
): StudioWorkspace {
  if (!raw) return "overview";
  if (isStudioWorkspace(raw)) return raw;
  return LEGACY_TAB[raw] || "overview";
}

export function resolveProjectTab(
  raw: string | null | undefined
): ProjectTab {
  return resolveStudioWorkspace(raw);
}

export function stageOf(_tab: ProjectTab): StageId {
  if (_tab === "outline" || _tab === "manuscript") return "write";
  if (_tab === "review" || _tab === "tools") return "review";
  return "setup";
}

export function setupTabs(_hasOriginal: boolean): ProjectTab[] {
  return ["library"];
}

export function workspaceOfLegacyPanel(panel: string): StudioWorkspace {
  return resolveStudioWorkspace(panel);
}
