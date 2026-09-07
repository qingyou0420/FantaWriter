import { describe, expect, it } from "vitest";
import { shouldInvalidateBookStageEvent } from "./use-book-stage";

describe("shouldInvalidateBookStageEvent", () => {
  it("drops /stage cache on truth:written", () => {
    expect(shouldInvalidateBookStageEvent("truth:written")).toBe(true);
  });

  it("still ignores progress and unrelated session events", () => {
    expect(shouldInvalidateBookStageEvent("write:complete")).toBe(true);
    expect(shouldInvalidateBookStageEvent("weave:progress")).toBe(false);
    expect(shouldInvalidateBookStageEvent("book:creating")).toBe(false);
    expect(shouldInvalidateBookStageEvent("session:title")).toBe(false);
  });
});
