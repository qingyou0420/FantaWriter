/**
 * 研墨定稿校验。Writes workflow.groundConfirmedAt; does not change G1.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { OpenQuestionsDoc } from "./open-questions.js";
import { openQuestionsBlockConfirm } from "./open-questions.js";

export interface GroundConfirmFacts {
  readonly storyFrameFourSections: boolean;
  readonly majorRoleCount: number;
  readonly openQuestions: OpenQuestionsDoc;
}

export interface GroundConfirmResult {
  readonly ok: boolean;
  readonly missing: ReadonlyArray<string>;
}

export function validateGroundConfirm(facts: GroundConfirmFacts, isZh: boolean): GroundConfirmResult {
  const missing: string[] = [];
  if (!facts.storyFrameFourSections) {
    missing.push(isZh ? "故事框架未齐：主题与基调 / 世界规则 / 关系与主线 / 结局 至少缺一段" : "story_frame is missing theme, world, conflict, or ending");
  }
  if (facts.majorRoleCount < 1) {
    missing.push(isZh ? "至少需要一位主角" : "Need at least one protagonist");
  }
  if (openQuestionsBlockConfirm(facts.openQuestions)) {
    missing.push(isZh ? "还有待定项，勾选「带着待定项继续」或清空清单" : "Open questions remain — clear them or continue with open items");
  }
  return { ok: missing.length === 0, missing };
}

export const GROUND_REEDIT_WARNING = {
  zh: "将影响后续织卷 / 落笔上下文",
  en: "Later weave and write context will change",
} as const;
