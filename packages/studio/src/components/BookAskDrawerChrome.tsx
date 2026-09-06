/**
 * Pinned story card + title edit at the top of the 问心 drawer.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import { AskStoryCard } from "./AskStoryCard";
import { fetchJson, putApi, useApi } from "../hooks/use-api";
import { EMPTY_STORY_CARD, parseStoryCard } from "../lib/story-card";
import { showToast } from "../lib/toast";

export function AskDrawerTitle({ bookId, isZh }: { readonly bookId: string; readonly isZh: boolean }) {
  const { data } = useApi<{ book?: { title?: string } }>(`/books/${bookId}`);
  const title = data?.book?.title ?? bookId;
  return <span>{isZh ? `问心 · 《${title}》` : `Ask · ${title}`}</span>;
}

export function BookAskDrawerChrome({
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
  const oneLine = card.oneLine || card.workingTitle || title;
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

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
      await refetch();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed", "error");
    }
  };

  return (
    <div className="shrink-0 border-b border-border/40 px-3 py-2 space-y-2" data-testid="ask-story-pin">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="w-full truncate text-left text-[13px] text-muted-foreground hover:text-foreground"
      >
        {isZh ? "故事卡" : "Story card"}
        {oneLine ? ` · ${oneLine}` : ""}
      </button>
      {expanded && (
        <div className="space-y-2">
          {editingTitle && (
            <div className="flex items-end gap-2">
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
          <AskStoryCard
            card={{ ...card, workingTitle: card.workingTitle || title }}
            editable={false}
            isZh={isZh}
            onEditTitle={() => setEditingTitle(true)}
          />
        </div>
      )}
    </div>
  );
}
