import { describe, expect, it } from "vitest";
import {
  addOpenQuestion,
  CONTINUE_WITH_OPEN_MARK,
  openQuestionsBlockConfirm,
  parseOpenQuestions,
  removeOpenQuestion,
  serializeOpenQuestions,
} from "./open-questions";

describe("open questions", () => {
  it("parses a checklist and the continue-with-open mark", () => {
    const doc = parseOpenQuestions([
      "# 待定项",
      `> ${CONTINUE_WITH_OPEN_MARK}`,
      "1. 反派真名未定",
      "- 终局是否开书院",
    ].join("\n"));
    expect(doc.continueWithOpen).toBe(true);
    expect(doc.items.map((item) => item.text)).toEqual(["反派真名未定", "终局是否开书院"]);
    expect(openQuestionsBlockConfirm(doc)).toBe(false);
  });

  it("blocks confirm when items remain and the mark is missing", () => {
    const doc = parseOpenQuestions("1. 还没定主角姓氏\n");
    expect(openQuestionsBlockConfirm(doc)).toBe(true);
    const cleared = removeOpenQuestion(doc, doc.items[0]!.id);
    expect(openQuestionsBlockConfirm(cleared)).toBe(false);
  });

  it("round-trips add / serialize", () => {
    const added = addOpenQuestion({ items: [], continueWithOpen: false }, "谁是主使");
    const raw = serializeOpenQuestions(added);
    expect(raw).toMatch(/谁是主使/);
    expect(parseOpenQuestions(raw).items[0]?.text).toBe("谁是主使");
  });
});
