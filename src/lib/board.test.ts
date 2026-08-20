import { describe, expect, it } from "vitest";
import { filterProjectsByBoard, shouldShowAgeGate } from "./board";
import { createEmptyProject } from "./types";
import type { AppPrefs } from "./theme";

describe("board helpers", () => {
  it("shows AgeGate only when defaultBoard is erotic and not confirmed", () => {
    const base: AppPrefs = {
      theme: "dark",
      autoConsistencyAfterBookJob: false,
    };
    expect(shouldShowAgeGate({ ...base, defaultBoard: "erotic" })).toBe(true);
    expect(
      shouldShowAgeGate({
        ...base,
        defaultBoard: "erotic",
        adultConfirmedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);
    expect(shouldShowAgeGate({ ...base, defaultBoard: "general" })).toBe(false);
  });

  it("filters lists by writingBoard and does not rewrite project.mode", () => {
    const g = createEmptyProject("常", "general");
    const e = createEmptyProject("色", "erotic");
    const visible = filterProjectsByBoard([g, e], "general");
    expect(visible.map((p) => p.id)).toEqual([g.id]);
    expect(e.writingBoard).toBe("erotic");
    expect(g.writingBoard).toBe("general");
  });
});
