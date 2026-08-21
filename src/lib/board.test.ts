import { describe, expect, it } from "vitest";
import { filterProjectsByBoard } from "./board";
import { createEmptyProject } from "./types";

describe("board helpers", () => {
  it("shows every project in this conventional edition", () => {
    const a = createEmptyProject("甲");
    const b = createEmptyProject("乙");
    expect(filterProjectsByBoard([a, b]).map((p) => p.id)).toEqual([a.id, b.id]);
    expect(a.writingBoard).toBe("general");
    expect(b.writingBoard).toBe("general");
  });
});
