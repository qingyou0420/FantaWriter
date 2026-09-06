/**
 * story/open_questions.md — 研墨待定项清单。
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const OPEN_QUESTIONS_FILE = "open_questions.md";
export const CONTINUE_WITH_OPEN_MARK = "带着待定项继续";

export interface OpenQuestionItem {
  readonly id: string;
  readonly text: string;
}

export interface OpenQuestionsDoc {
  readonly items: ReadonlyArray<OpenQuestionItem>;
  readonly continueWithOpen: boolean;
}

export function parseOpenQuestions(markdown: string): OpenQuestionsDoc {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const continueWithOpen = lines.some((line) => line.includes(CONTINUE_WITH_OPEN_MARK));
  const items: OpenQuestionItem[] = [];
  lines.forEach((line, index) => {
    const match = /^\s*(?:[-*]|(\d+)\.)\s+(?:\[.\]\s+)?(.+)$/.exec(line);
    if (!match) return;
    const text = match[2]!.trim();
    if (!text || text.includes(CONTINUE_WITH_OPEN_MARK)) return;
    items.push({ id: `q-${index}`, text });
  });
  if (items.length === 0) {
    for (const [index, line] of lines.entries()) {
      const text = line.trim();
      if (!text || text.startsWith("#") || text.includes(CONTINUE_WITH_OPEN_MARK)) continue;
      items.push({ id: `q-${index}`, text });
    }
  }
  return { items, continueWithOpen };
}

export function serializeOpenQuestions(doc: OpenQuestionsDoc): string {
  const lines: string[] = ["# 待定项", ""];
  if (doc.continueWithOpen) {
    lines.push(`> ${CONTINUE_WITH_OPEN_MARK}`, "");
  }
  if (doc.items.length === 0) {
    lines.push("");
    return lines.join("\n");
  }
  doc.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.text.trim()}`);
  });
  lines.push("");
  return lines.join("\n");
}

export function openQuestionsBlockConfirm(doc: OpenQuestionsDoc): boolean {
  return doc.items.length > 0 && !doc.continueWithOpen;
}

export function addOpenQuestion(doc: OpenQuestionsDoc, text: string): OpenQuestionsDoc {
  const trimmed = text.trim();
  if (!trimmed) return doc;
  return {
    ...doc,
    items: [...doc.items, { id: `q-${Date.now()}`, text: trimmed }],
  };
}

export function removeOpenQuestion(doc: OpenQuestionsDoc, id: string): OpenQuestionsDoc {
  return { ...doc, items: doc.items.filter((item) => item.id !== id) };
}
