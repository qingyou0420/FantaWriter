import { describe, it, expect } from "vitest";
import { parseHash, routeToHash } from "../hooks/use-hash-route";

describe("flow route", () => {
  it("parses #/flow/:id", () => { expect(parseHash("#/flow/p1")).toEqual({ page: "flow", projectId: "p1" }); });
  it("round-trips", () => { expect(routeToHash({ page: "flow", projectId: "p1" })).toBe("#/flow/p1"); });
});
