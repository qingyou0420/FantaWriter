import { describe, expect, it } from "vitest";
import { buildFilmAuthoringToolNames } from "../agent/film-authoring-tools.js";

describe("interactive-film-authoring tool set", () => {
  it("unconfirmed set = direct-write tools + propose_action", () => {
    const names = buildFilmAuthoringToolNames(undefined);
    expect(names).toContain("set_world_anchor");
    expect(names).toContain("fill_node");
    expect(names).toContain("generate_node_image");
    expect(names).toContain("propose_action");
    expect(names).not.toContain("draft_structure");
  });
  it("confirmed draft_structure = the structure tool", () => {
    expect(buildFilmAuthoringToolNames("draft_structure")).toEqual(["draft_structure"]);
  });
  it("confirmed connect_choice = the connect tool", () => {
    expect(buildFilmAuthoringToolNames("connect_choice")).toEqual(["connect_choice"]);
  });
  it("confirmed remove_node = the remove tool", () => {
    expect(buildFilmAuthoringToolNames("remove_node")).toEqual(["remove_node"]);
  });
});
