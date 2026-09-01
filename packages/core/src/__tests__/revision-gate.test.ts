import { describe, expect, it } from "vitest";
import { resolveRevisionGate } from "../models/book.js";

describe("resolveRevisionGate", () => {
  it("book-level revisionGate overrides project-level revisionGate", () => {
    expect(resolveRevisionGate(
      { writing: { revisionGate: "always" } },
      { revisionGate: "lenient" },
    )).toBe("always");

    expect(resolveRevisionGate(
      { writing: { revisionGate: "strict" } },
      { revisionGate: "always" },
    )).toBe("strict");
  });

  it("falls back to project-level revisionGate when book does not set one", () => {
    expect(resolveRevisionGate({}, { revisionGate: "lenient" })).toBe("lenient");
    expect(resolveRevisionGate(
      { writing: {} },
      { revisionGate: "always" },
    )).toBe("always");
  });

  it("defaults to strict when neither book nor project sets a revisionGate", () => {
    expect(resolveRevisionGate({})).toBe("strict");
    expect(resolveRevisionGate({ writing: {} }, {})).toBe("strict");
  });
});
