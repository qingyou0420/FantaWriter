import { describe, it, expect, beforeEach } from "vitest";
import { readStoredToolDetailsDefaultOpen, usePreferencesStore, TOOL_DETAILS_STORAGE_KEY } from "./store";

function fakeStorage(entries: Record<string, string>) {
  return {
    getItem: (key: string) => (key in entries ? entries[key] : null),
  };
}

describe("readStoredToolDetailsDefaultOpen", () => {
  it("defaults to true when no storage is available", () => {
    expect(readStoredToolDetailsDefaultOpen(null)).toBe(true);
    expect(readStoredToolDetailsDefaultOpen(undefined)).toBe(true);
  });

  it("defaults to true when nothing is stored", () => {
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({}))).toBe(true);
  });

  it("returns false only for an explicitly stored \"false\"", () => {
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({ [TOOL_DETAILS_STORAGE_KEY]: "false" }))).toBe(false);
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({ [TOOL_DETAILS_STORAGE_KEY]: "true" }))).toBe(true);
    expect(readStoredToolDetailsDefaultOpen(fakeStorage({ [TOOL_DETAILS_STORAGE_KEY]: "garbage" }))).toBe(true);
  });
});

describe("usePreferencesStore", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ toolDetailsDefaultOpen: true });
  });

  it("starts with details expanded by default", () => {
    expect(usePreferencesStore.getState().toolDetailsDefaultOpen).toBe(true);
  });

  it("setToolDetailsDefaultOpen updates the state", () => {
    usePreferencesStore.getState().setToolDetailsDefaultOpen(false);
    expect(usePreferencesStore.getState().toolDetailsDefaultOpen).toBe(false);

    usePreferencesStore.getState().setToolDetailsDefaultOpen(true);
    expect(usePreferencesStore.getState().toolDetailsDefaultOpen).toBe(true);
  });
});
