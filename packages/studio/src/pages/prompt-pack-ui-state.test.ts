import { describe, expect, it } from "vitest";
import { groupPromptPacksForDisplay } from "./prompt-pack-ui-state";

describe("prompt pack UI state", () => {
  it("groups prompts under pack order and keeps orphan prompts at the end", () => {
    const groups = groupPromptPacksForDisplay({
      packs: [
        { id: "play", title: "Play", prompts: ["play.renderer"] },
        { id: "longform", title: "Longform", prompts: ["longform.writer"] },
      ],
      prompts: [
        { id: "orphan.prompt", packId: "custom", title: "Orphan", source: "project", overridden: true },
        { id: "longform.writer", packId: "longform", title: "Writer", source: "builtin", overridden: false },
        { id: "play.renderer", packId: "play", title: "Renderer", source: "project", overridden: true },
      ],
    });

    expect(groups.map((group) => group.id)).toEqual(["play", "longform", "custom"]);
    expect(groups[0]?.prompts.map((prompt) => prompt.id)).toEqual(["play.renderer"]);
    expect(groups[2]).toMatchObject({
      id: "custom",
      title: "custom",
      prompts: [expect.objectContaining({ id: "orphan.prompt" })],
    });
  });
});
