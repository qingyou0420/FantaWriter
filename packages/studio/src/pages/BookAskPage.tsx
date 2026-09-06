/**
 * 问心 after the book exists: read-only story card + 重开问心.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import { AskStoryCard } from "../components/AskStoryCard";
import { BookWorkspaceNav, type BookWorkspaceNavTarget } from "../components/BookWorkspaceNav";
import { LiteraryEmpty } from "../components/LiteraryEmpty";
import { fetchJson, putApi, useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import { EMPTY_STORY_CARD, parseStoryCard, REOPEN_ASK_PROMPT } from "../lib/story-card";
import { showToast } from "../lib/toast";
import { useChatStore } from "../store/chat";

interface Nav extends BookWorkspaceNavTarget {
  readonly toDashboard: () => void;
}

export function BookAskPage({
  bookId,
  nav,
  t,
  isZh,
}: {
  readonly bookId: string;
  readonly nav: Nav;
  readonly t: TFunction;
  readonly isZh: boolean;
}) {
  const { data } = useApi<{ book?: { title?: string } }>(`/books/${bookId}`);
  const { data: fileData, refetch } = useApi<{ content?: string | null }>(`/books/${bookId}/truth/story_card.md`);
  const title = data?.book?.title ?? bookId;
  const card = fileData?.content ? parseStoryCard(fileData.content) : EMPTY_STORY_CARD;
  const createDraftSession = useChatStore((state) => state.createDraftSession);
  const setInput = useChatStore((state) => state.setInput);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  const reopen = () => {
    createDraftSession(bookId, "book");
    setInput(isZh ? REOPEN_ASK_PROMPT.zh : REOPEN_ASK_PROMPT.en);
    (nav.onToggleChat ?? nav.toBookChat)(bookId);
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
        const updated = parseStoryCard(fileData.content);
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
        void updated;
      }
      setEditingTitle(false);
      await refetch();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.error"), "error");
    }
  };

  return (
    <div className="space-y-6 fade-in" data-testid="book-ask-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <button type="button" onClick={nav.toDashboard} className="hover:text-primary">
            {t("bread.books")}
          </button>
          <span className="text-border">/</span>
          <button type="button" onClick={() => nav.toBook(bookId)} className="hover:text-primary">
            {title}
          </button>
          <span className="text-border">/</span>
          <span className="text-foreground">{isZh ? "问心" : "Ask"}</span>
        </nav>
        <BookWorkspaceNav bookId={bookId} active="ask" nav={nav} isZh={isZh} chatOpen={Boolean(nav.chatOpen)} t={t} />
      </div>

      <header className="space-y-2">
        <h1 className="font-serif text-[40px]">{isZh ? "问心" : "Ask"}</h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          {isZh ? "故事卡已落下。重开问心只开新对谈，不改已确认的正典。" : "The story card is set. Reopening Ask starts a new talk and leaves canon untouched."}
        </p>
      </header>

      {editingTitle && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[16rem] flex-1 space-y-1">
            <span className="text-[13px] text-muted-foreground">{isZh ? "书名" : "Title"}</span>
            <input
              data-testid="ask-title-edit"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
            />
          </label>
          <button type="button" onClick={() => void saveTitle()} className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">
            {isZh ? "保存书名" : "Save title"}
          </button>
        </div>
      )}

      {fileData?.content ? (
        <div className="max-w-md">
          <AskStoryCard
            card={{ ...card, workingTitle: card.workingTitle || title }}
            editable={false}
            isZh={isZh}
            onEditTitle={() => setEditingTitle(true)}
            onReopen={reopen}
          />
        </div>
      ) : (
        <LiteraryEmpty
          title={isZh ? "故事卡还没落下" : "No story card yet"}
          subtitle={isZh ? "从对谈里重开问心，把书名、一句话和梗概磨清。" : "Reopen Ask and settle the title, one-liner, and synopsis."}
          action={isZh ? "重开问心" : "Reopen Ask"}
          onAction={reopen}
          testId="ask-empty"
        />
      )}
    </div>
  );
}
