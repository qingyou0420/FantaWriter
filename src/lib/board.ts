import type { AppPrefs } from "./theme";
import type { NovelProject, WritingBoard } from "./types";

export function shouldShowAgeGate(prefs: AppPrefs): boolean {
  return prefs.defaultBoard === "erotic" && !prefs.adultConfirmedAt;
}

export function filterProjectsByBoard(
  projects: NovelProject[],
  board: WritingBoard
): NovelProject[] {
  return projects.filter((p) => p.writingBoard === board);
}

export function isEroticCodedStyle(
  style: string
): style is "passionate" | "restrained" {
  return style === "passionate" || style === "restrained";
}
