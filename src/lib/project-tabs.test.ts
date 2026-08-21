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

  it("keeps the settings stage at most 6 tabs including original", () => {
    expect(setupTabs(true)).toHaveLength(6);
    expect(setupTabs(false)).toHaveLength(5);
    expect(setupTabs(false)).not.toContain("original");
    const all = [
      ...setupTabs(true),
      "outline",
      "chapters",
      "plot",
      "tools",
    ];
    expect(all.length).toBeLessThanOrEqual(10);
  });
});
