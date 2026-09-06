import { describe, expect, it } from "vitest";
import { validateGroundConfirm } from "./ground-confirm";

describe("validateGroundConfirm", () => {
  it("lists missing story_frame, protagonist, and open questions", () => {
    const result = validateGroundConfirm({
      storyFrameFourSections: false,
      majorRoleCount: 0,
      openQuestions: { items: [{ id: "q-1", text: "未定" }], continueWithOpen: false },
    }, true);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(3);
  });

  it("passes when four sections, one protagonist, and no open items", () => {
    const result = validateGroundConfirm({
      storyFrameFourSections: true,
      majorRoleCount: 1,
      openQuestions: { items: [], continueWithOpen: false },
    }, true);
    expect(result.ok).toBe(true);
  });

  it("allows leftover questions when the author continues with open items", () => {
    const result = validateGroundConfirm({
      storyFrameFourSections: true,
      majorRoleCount: 2,
      openQuestions: { items: [{ id: "q-1", text: "未定" }], continueWithOpen: true },
    }, true);
    expect(result.ok).toBe(true);
  });
});
