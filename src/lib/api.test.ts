import { describe, expect, it } from "vitest";
import { finishStreamGenerate } from "./api";

describe("finishStreamGenerate", () => {
  it("rejects truncated SSE that never sent done", () => {
    expect(() => finishStreamGenerate(false, "半截正文")).toThrow(
      "流意外中断，正文可能不完整"
    );
  });

  it("returns full text when done was seen", () => {
    expect(finishStreamGenerate(true, "完整一章")).toBe("完整一章");
  });
});
