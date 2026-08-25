import { describe, expect, it } from "vitest";
import { shouldDisableHomeCreateFields } from "./home-boot";

describe("shouldDisableHomeCreateFields", () => {
  it("keeps create fields typable while storage is still booting", () => {
    expect(shouldDisableHomeCreateFields(false)).toBe(false);
    expect(shouldDisableHomeCreateFields(true)).toBe(false);
  });
});
