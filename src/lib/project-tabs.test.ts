import { describe, expect, it } from "vitest";
import {
  resolveProjectTab,
  resolveStudioWorkspace,
  setupTabs,
  STUDIO_NAV,
} from "./project-tabs";

describe("resolveStudioWorkspace", () => {
  it("maps deleted and old tab names to a live workspace", () => {
    expect(resolveStudioWorkspace("progress")).toBe("tools");
    expect(resolveStudioWorkspace("tags")).toBe("tools");
    expect(resolveStudioWorkspace("nope")).toBe("overview");
    expect(resolveStudioWorkspace(null)).toBe("overview");
    expect(resolveStudioWorkspace("chapters")).toBe("manuscript");
    expect(resolveStudioWorkspace("premise")).toBe("library");
    expect(resolveStudioWorkspace("characters")).toBe("library");
    expect(resolveStudioWorkspace("original")).toBe("tools");
    expect(resolveStudioWorkspace("plot")).toBe("library");
    expect(resolveStudioWorkspace("volumes")).toBe("outline");
    expect(resolveProjectTab("manuscript")).toBe("manuscript");
  });

  it("keeps seven studio workspaces", () => {
    expect(STUDIO_NAV).toHaveLength(7);
    expect(STUDIO_NAV.map((n) => n.id)).toEqual([
      "overview",
      "outline",
      "manuscript",
      "review",
      "library",
      "sessions",
      "tools",
    ]);
    expect(setupTabs(true)).toEqual(["library"]);
  });
});
