import { describe, expect, it } from "vitest";
import { deriveShortStudy, shortStudyCtaLabel } from "./short-study";

describe("deriveShortStudy", () => {
  it("starts at 问心 before direction or outline", () => {
    const snap = deriveShortStudy({ status: "outlining", hasDirection: false });
    expect(snap.stage).toBe("ask");
    expect(snap.primaryCta).toBe("ask");
    expect(shortStudyCtaLabel(snap.primaryCta, true)).toBe("继续问心");
  });

  it("moves to 织卷 when an outline exists", () => {
    const snap = deriveShortStudy({ status: "outlining", contentKind: "outline", hasDirection: true });
    expect(snap.stage).toBe("weave");
    expect(snap.steps.ask).toBe("done");
    expect(snap.primaryCta).toBe("outline");
  });

  it("uses 落笔 / 导出 for draft and completed shorts", () => {
    expect(deriveShortStudy({ status: "drafting", contentKind: "draft" }).primaryCta).toBe("write");
    expect(deriveShortStudy({ status: "completed", contentKind: "manuscript" }).primaryCta).toBe("export");
    expect(shortStudyCtaLabel("export", true)).toBe("导出");
  });
});
