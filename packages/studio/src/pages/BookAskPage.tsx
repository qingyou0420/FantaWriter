/**
 * P0 shell for 问心. Full story-card page is P2-1.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { BookWorkspaceNav, type BookWorkspaceNavTarget } from "../components/BookWorkspaceNav";
import { useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";

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
  const title = data?.book?.title ?? bookId;

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
        <BookWorkspaceNav bookId={bookId} active="ask" nav={nav} isZh={isZh} chatOpen={Boolean(nav.chatOpen)} />
      </div>
      <header className="space-y-2">
        <h1 className="font-serif text-3xl">{isZh ? "问心" : "Ask"}</h1>
        <p className="text-sm text-muted-foreground">
          {isZh ? "先聊清楚这本书讲什么。完整故事卡会在后续版本到来。" : "Settle what this book is about. The full story card arrives in a later pass."}
        </p>
      </header>
      <button
        type="button"
        onClick={() => (nav.onToggleChat ?? nav.toBookChat)(bookId)}
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {isZh ? "打开对谈" : "Open talk"}
      </button>
    </div>
  );
}
