import { describe, expect, it, afterEach } from "vitest";
import {
  buildReviewChapterPrompt,
  listReviewDimensions,
  locateEvidenceOffset,
  parseReviewPayload,
  registerReviewDimension,
  resetReviewDimensions,
  reviewStateAfterIssues,
  scoreFromIssues,
} from "./review-registry";

afterEach(() => {
  resetReviewDimensions();
});

describe("review registry", () => {
  it("ships ten core dimensions", () => {
    expect(listReviewDimensions()).toHaveLength(10);
  });

  it("adds an 11th dimension with config + prompt only", () => {
    registerReviewDimension({
      id: "timeline",
      label: "时间线",
      weight: 6,
      prompt: "日期与昼夜是否跳变。",
    });
    const dims = listReviewDimensions();
    expect(dims).toHaveLength(11);
    const { user } = buildReviewChapterPrompt({
      title: "一",
      content: "正文",
    });
    expect(user).toContain("[timeline]");
    expect(user).toContain("时间线");
  });

  it("parses issues and scores from weighted deductions", () => {
    const parsed = parseReviewPayload(
      '前言 {"score":80,"issues":[{"dimension":"forbid","severity":"high","title":"触禁","evidence":"穿越了","suggestion":"删","locatable":true}]} 后记'
    );
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.score).toBe(80);
    expect(scoreFromIssues(parsed.issues)).toBeLessThan(100);
  });

  it("marks reviewed only when there is no high-severity issue", () => {
    expect(reviewStateAfterIssues([])).toBe("reviewed");
    expect(
      reviewStateAfterIssues([{ severity: "medium" }, { severity: "low" }])
    ).toBe("reviewed");
    expect(reviewStateAfterIssues([{ severity: "high" }])).toBe("draft");
  });

  it("locates evidence in the manuscript", () => {
    const content = "霜落在第三块缺角石上。沈烬没有回头。";
    expect(locateEvidenceOffset(content, "沈烬没有回头")).toBeGreaterThan(0);
    expect(locateEvidenceOffset(content, "不存在的句子")).toBe(-1);
  });
});
