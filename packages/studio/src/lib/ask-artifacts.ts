/**
 * Persist 问心 artifacts after create_book. Not a G1 gate.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBookWorkflow } from "./book-stage-io.js";
import type { BookWorkflowJson } from "./book-stage.js";
import {
  authorIntentFromStoryCard,
  serializeStoryCard,
  storyCardReady,
  trimStoryCard,
  type StoryCardDraft,
} from "./story-card.js";

export async function writeBookWorkflow(bookDir: string, workflow: BookWorkflowJson): Promise<void> {
  const storyDir = join(bookDir, "story");
  await mkdir(storyDir, { recursive: true });
  await writeFile(join(storyDir, "workflow.json"), `${JSON.stringify(workflow, null, 2)}\n`, "utf-8");
}

export async function persistAskArtifacts(input: {
  readonly bookDir: string;
  readonly card: StoryCardDraft;
  readonly language?: "zh" | "en";
  readonly instruction?: string;
  readonly nowIso?: string;
}): Promise<StoryCardDraft> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const card = trimStoryCard({
    ...input.card,
    synopsis: input.card.synopsis.trim() || (input.instruction ?? "").trim().slice(0, 300),
  });
  const storyDir = join(input.bookDir, "story");
  await mkdir(storyDir, { recursive: true });
  if (card.workingTitle || card.oneLine || card.synopsis) {
    await writeFile(join(storyDir, "story_card.md"), serializeStoryCard(card), "utf-8");
  }
  const intentPath = join(storyDir, "author_intent.md");
  let existingIntent = "";
  try {
    existingIntent = await readFile(intentPath, "utf-8");
  } catch {
    existingIntent = "";
  }
  const placeholder = /作者意图待填写|Author intent placeholder|还没有写下/i.test(existingIntent);
  if (storyCardReady(card) && (!existingIntent.trim() || placeholder)) {
    await writeFile(intentPath, authorIntentFromStoryCard(card, input.language ?? "zh"), "utf-8");
  }
  const existing = await loadBookWorkflow(input.bookDir);
  await writeBookWorkflow(input.bookDir, {
    ...existing,
    askConfirmedAt: existing?.askConfirmedAt ?? nowIso,
    lastStage: existing?.lastStage ?? "ground",
  });
  return card;
}
