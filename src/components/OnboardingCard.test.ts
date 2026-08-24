import { describe, expect, it } from "vitest";
import { shouldShowOnboarding } from "./OnboardingCard";
import { createEmptyProject, type NovelProject } from "@/lib/types";

describe("shouldShowOnboarding", () => {
  it("shows for a from-scratch empty book even if characters is missing", () => {
    const p = createEmptyProject("从零");
    expect(shouldShowOnboarding(p)).toBe(true);
    const raw = { ...p } as NovelProject;
    delete (raw as { characters?: NovelProject["characters"] }).characters;
    expect(shouldShowOnboarding(raw)).toBe(true);
  });

  it("hides once a character has a name", () => {
    const p = createEmptyProject("从零");
    p.characters[0].name = "甲";
    expect(shouldShowOnboarding(p)).toBe(false);
  });
});
