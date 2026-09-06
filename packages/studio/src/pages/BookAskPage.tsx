/**
 * 问心 page: full-page book chat + story rail.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { AskStoryRail } from "../components/AskStoryRail";
import { useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import type { Theme } from "../hooks/use-theme";
import { ChatPage } from "./ChatPage";

interface Nav {
  readonly toDashboard: () => void;
  readonly toServices: () => void;
  readonly toFilm: (projectId: string) => void;
  readonly toFilmStudio: (projectId: string) => void;
}

export function BookAskPage({
  bookId,
  nav,
  theme,
  t,
  sse,
  isZh,
}: {
  readonly bookId: string;
  readonly nav: Nav;
  readonly theme: Theme;
  readonly t: TFunction;
  readonly sse: { messages: ReadonlyArray<SSEMessage>; connected: boolean };
  readonly isZh: boolean;
}) {
  const { error } = useApi<{ book?: { title?: string } }>(`/books/${bookId}`);

  if (error) return <div className="text-destructive p-8">Error: {error}</div>;

  return (
    <div className="flex h-full min-h-0 flex-1">
      <ChatPage
        activeBookId={bookId}
        mode="book"
        nav={nav}
        theme={theme}
        t={t}
        sse={sse}
      />
      <AskStoryRail bookId={bookId} isZh={isZh} />
    </div>
  );
}
