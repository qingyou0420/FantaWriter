import { describe, it, expect } from "vitest";
import { parseHash, routeToHash } from "../hooks/use-hash-route";
describe("film-studio route", () => {
  it("parses #/studio/film/:id", () => { expect(parseHash("#/studio/film/p1")).toEqual({ page: "film-studio", projectId: "p1" }); });
  it("round-trips", () => { expect(routeToHash({ page: "film-studio", projectId: "p1" })).toBe("#/studio/film/p1"); });
});
