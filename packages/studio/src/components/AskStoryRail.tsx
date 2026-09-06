/**
 * Right rail on #/book/:id/ask: read-only story card + title edit.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import { AskStoryCard } from "./AskStoryCard";
import { LiteraryEmpty } from "./LiteraryEmpty";
import { fetchJson, putApi, useApi } from "../hooks/use-api";
import { EMPTY_STORY_CARD, parseStoryCard, REOPEN_ASK_PROMPT } from "../lib/story-card";
import { showToast } from "../lib/toast";
import { useChatStore } from "../store/chat";

export function AskStoryRail({
  bookId,
  isZh,
}: {
  readonly bookId: string;
  readonly isZh: boolean;
}) {
  const { data: fileData, refetch } = useApi<{ content?: string | null }>(`/books/${bookId}/truth/story_card.md`);
  const { data: bookData } = useApi<{ book?: { title?: string } }>(`/books/${bookId}`);
  const title = bookData?.book?.title ?? "";
  const card = fileData?.content ? parseStoryCard(fileData.content) : EMPTY_STORY_CARD;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const createDraftSession = useChatStore((state) => state.createDraftSession);
  const setInput = useChatStore((state) => state.setInput);
  const bumpBookDataVersion = useChatStore((state) => state.bumpBookDataVersion);

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  const reopen = () => {
    createDraftSession(bookId, "book");
    setInput(isZh ? REOPEN_ASK_PROMPT.zh : REOPEN_ASK_PROMPT.en);
  };

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (!next || next === title) {
      setEditingTitle(false);
      return;
    }
    try {
      await putApi(`/books/${bookId}`, { title: next });
      if (fileData?.content) {
        await fetchJson(`/books/${bookId}/truth/story_card.md`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: fileData.content.replace(
              /working_title:\s*.*/,
              `working_title: ${JSON.stringify(next)}`,
            ),
          }),
        });
      }
      setEditingTitle(false);
      bumpBookDataVersion();
      await refetch();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed", "error");
    }
  };

  return (
    <aside
      className="hidden h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-border/40 bg-background/40 p-4 lg:flex"
      data-testid="ask-story-rail"
    >
      {editingTitle && (
        <div className="mb-3 flex items-end gap-2">
          <input
            data-testid="ask-title-edit"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void saveTitle()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
          >
            {isZh ? "保存书名" : "Save title"}
          </button>
        </div>
      )}
      {fileData?.content ? (
        <AskStoryCard
          card={{ ...card, workingTitle: card.workingTitle || title }}
          editable={false}
          isZh={isZh}
          onEditTitle={() => setEditingTitle(true)}
        />
      ) : (
        <LiteraryEmpty
          title={isZh ? "故事卡还没落下" : "No story card yet"}
          subtitle={isZh ? "从问心里重新推敲前提，把书名、一句话和梗概磨清。" : "Revisit the premise and settle the title, one-liner, and synopsis."}
          action={isZh ? "重新推敲前提" : "Revisit the premise"}
          onAction={reopen}
          testId="ask-empty"
        />
      )}
    </aside>
  );
}
