import { describe, expect, it } from "vitest";
import { resolveProjectTab, setupTabs } from "./project-tabs";

describe("resolveProjectTab", () => {
  it("maps deleted tab names to a live page", () => {
    expect(resolveProjectTab("progress")).toBe("tools");
    expect(resolveProjectTab("tags")).toBe("settings");
    expect(resolveProjectTab("nope")).toBe("characters");
    expect(resolveProjectTab(null)).toBe("characters");
    expect(resolveProjectTab("chapters")).toBe("chapters");
  });

  it("keeps the settings stage at most 7 tabs including original and premise", () => {
    expect(setupTabs(true)).toHaveLength(7);
    expect(setupTabs(false)).toHaveLength(6);
    expect(setupTabs(false)).not.toContain("original");
    expect(setupTabs(false)[0]).toBe("premise");
    const all = [
      ...setupTabs(true),
      "outline",
      "chapters",
      "plot",
      "tools",
    ];
    expect(all.length).toBeLessThanOrEqual(11);
  });
});
