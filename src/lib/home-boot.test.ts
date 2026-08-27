import { describe, expect, it } from "vitest";
import {
  homeCreateFieldsDisabledState,
  shouldDisableHomeCreateFields,
  shouldStartHomeLibraryBootImmediately,
  SILENT_UPDATE_DELAY_MS,
} from "./home-boot";

describe("shouldDisableHomeCreateFields", () => {
  it("keeps create fields typable while storage is still booting", () => {
    expect(shouldDisableHomeCreateFields(false)).toBe(false);
    expect(shouldDisableHomeCreateFields(true)).toBe(false);
  });

  it("keeps every visible create field enabled for library / update / init", () => {
    const state = homeCreateFieldsDisabledState({
      storageReady: false,
      updateBusy: true,
      configReady: false,
      libraryReady: false,
    });
    expect(state["project-name"]).toBe(false);
    expect(state["original-title"]).toBe(false);
    expect(state["original-text"]).toBe(false);
  });

  it("does not disable the form for library / update / config / init flags", () => {
    const flags = [true, false];
    for (const storageReady of flags) {
      for (const updateBusy of flags) {
        for (const configReady of flags) {
          for (const libraryReady of flags) {
            expect(
              shouldDisableHomeCreateFields({
                storageReady,
                updateBusy,
                configReady,
                libraryReady,
              })
            ).toBe(false);
          }
        }
      }
    }
  });
});

describe("homepage boot scheduling", () => {
  it("does not start library I/O on the first paint tick", () => {
    expect(shouldStartHomeLibraryBootImmediately()).toBe(false);
  });

  it("defers silent update long enough that first input is not competing", () => {
    expect(SILENT_UPDATE_DELAY_MS).toBeGreaterThanOrEqual(15_000);
  });
});
