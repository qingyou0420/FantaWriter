import { describe, expect, it } from "vitest";
import { buildProjectExportDownloadUrl } from "./StoryGraphTree";

describe("buildProjectExportDownloadUrl", () => {
  it("points to the interactive-film package export endpoint", () => {
    expect(buildProjectExportDownloadUrl("demo")).toBe("/api/v1/projects/demo/export");
  });
});
