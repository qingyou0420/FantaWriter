import { describe, expect, it } from "vitest";
import { shouldSnapToWizardVolume } from "./outline-focus";

describe("shouldSnapToWizardVolume", () => {
  it("snaps once when the wizard opens", () => {
    expect(shouldSnapToWizardVolume(null, "vol-1")).toBe(true);
    expect(shouldSnapToWizardVolume(undefined, "vol-1")).toBe(true);
  });

  it("does not snap again when the project updates but the wizard stays open", () => {
    expect(shouldSnapToWizardVolume("vol-1", "vol-1")).toBe(false);
  });

  it("does not snap after dismiss", () => {
    expect(shouldSnapToWizardVolume("vol-1", null)).toBe(false);
    expect(shouldSnapToWizardVolume("vol-1", undefined)).toBe(false);
  });

  it("snaps again if a different volume wizard opens", () => {
    expect(shouldSnapToWizardVolume("vol-1", "vol-2")).toBe(true);
  });
});
