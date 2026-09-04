import type { SSEMessage } from "./use-sse";

const START_EVENTS = new Set(["write:start", "draft:start"]);
const TERMINAL_EVENTS = new Set(["write:complete", "write:error", "draft:complete", "draft:error"]);
const BOOK_REFRESH_EVENTS = new Set([
  "write:complete",
  "write:error",
  "draft:complete",
  "draft:error",
  "rewrite:complete",
  "rewrite:error",
  "revise:complete",
  "revise:error",
  "audit:complete",
  "audit:error",
]);

const BOOK_COLLECTION_REFRESH_EVENTS = new Set([
  "book:created",
  "book:deleted",
  "short:deleted",
  "short:updated",
  "book:error",
  "write:complete",
  "write:error",
  "draft:complete",
  "draft:error",
  "rewrite:complete",
  "rewrite:error",
  "revise:complete",
  "revise:error",
  "audit:complete",
  "audit:error",
]);

const DAEMON_STATUS_REFRESH_EVENTS = new Set([
  "daemon:started",
  "daemon:stopped",
  "daemon:error",
]);

export interface BookActivity {
  readonly writing: boolean;
  readonly drafting: boolean;
  readonly lastError: string | null;
}

export interface SidebarBookSummary {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly chaptersWritten: number;
}

function getBookId(message: SSEMessage): string | null {
  const data = message.data as { bookId?: unknown } | null;
  return typeof data?.bookId === "string" ? data.bookId : null;
}

function getShortId(message: SSEMessage): string | null {
  const data = message.data as { shortId?: unknown; bookId?: unknown } | null;
  if (typeof data?.shortId === "string") return data.shortId;
  return typeof data?.bookId === "string" ? data.bookId : null;
}

function getBookSummary(message: SSEMessage): SidebarBookSummary | null {
  const data = message.data as { book?: unknown } | null;
  const book = data?.book;
  if (!book || typeof book !== "object") return null;
  const candidate = book as Partial<SidebarBookSummary>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.genre !== "string" ||
    typeof candidate.status !== "string" ||
    typeof candidate.chaptersWritten !== "number"
  ) {
    return null;
  }
  return {
    id: candidate.id,
    title: candidate.title,
    genre: candidate.genre,
    status: candidate.status,
    chaptersWritten: candidate.chaptersWritten,
  };
}

export function deriveActiveBookIds(messages: ReadonlyArray<SSEMessage>): ReadonlySet<string> {
  const active = new Set<string>();

  for (const message of messages) {
    const bookId = getBookId(message);
    if (!bookId) continue;

    if (START_EVENTS.has(message.event)) {
      active.add(bookId);
      continue;
    }

    if (TERMINAL_EVENTS.has(message.event)) {
      active.delete(bookId);
    }
  }

  return active;
}

export function deriveBookActivity(messages: ReadonlyArray<SSEMessage>, bookId: string): BookActivity {
  let writing = false;
  let drafting = false;
  let lastError: string | null = null;

  for (const message of messages) {
    if (getBookId(message) !== bookId) continue;

    const data = message.data as { error?: unknown } | null;

    switch (message.event) {
      case "write:start":
        writing = true;
        lastError = null;
        break;
      case "write:complete":
        writing = false;
        lastError = null;
        break;
      case "write:error":
        writing = false;
        lastError = typeof data?.error === "string" ? data.error : "Unknown error";
        break;
      case "draft:start":
        drafting = true;
        lastError = null;
        break;
      case "draft:complete":
        drafting = false;
        lastError = null;
        break;
      case "draft:error":
        drafting = false;
        lastError = typeof data?.error === "string" ? data.error : "Unknown error";
        break;
      default:
        break;
    }
  }

  return { writing, drafting, lastError };
}

export function shouldRefetchBookView(message: SSEMessage, bookId: string): boolean {
  return getBookId(message) === bookId && BOOK_REFRESH_EVENTS.has(message.event);
}

export function shouldRefetchBookCollections(message: SSEMessage | undefined): boolean {
  return Boolean(message && BOOK_COLLECTION_REFRESH_EVENTS.has(message.event));
}

export function shouldRefetchDaemonStatus(message: SSEMessage | undefined): boolean {
  return Boolean(message && DAEMON_STATUS_REFRESH_EVENTS.has(message.event));
}

export function removeBookFromCollection<T extends { readonly id: string }>(
  books: ReadonlyArray<T>,
  bookId: string,
): ReadonlyArray<T> {
  return books.filter((book) => book.id !== bookId);
}

export function removeShortFromCollection<T extends { readonly id: string }>(
  shorts: ReadonlyArray<T>,
  shortId: string,
): ReadonlyArray<T> {
  return shorts.filter((short) => short.id !== shortId);
}

export function applyBookCollectionEvent(
  books: ReadonlyArray<SidebarBookSummary>,
  message: SSEMessage | undefined,
): ReadonlyArray<SidebarBookSummary> | null {
  if (!message) return null;

  if (message.event === "book:created") {
    const book = getBookSummary(message);
    if (!book) return null;
    const existingIndex = books.findIndex((candidate) => candidate.id === book.id);
    if (existingIndex < 0) {
      return [...books, book];
    }
    return books.map((candidate, index) => index === existingIndex ? book : candidate);
  }

  if (message.event === "book:deleted") {
    const bookId = getBookId(message);
    if (!bookId) return null;
    return removeBookFromCollection(books, bookId);
  }

  return null;
}

export function applyShortCollectionEvent<T extends { readonly id: string }>(
  shorts: ReadonlyArray<T>,
  message: SSEMessage | undefined,
): ReadonlyArray<T> | null {
  if (!message) return null;

  if (message.event === "short:deleted") {
    const shortId = getShortId(message);
    if (!shortId) return null;
    return removeShortFromCollection(shorts, shortId);
  }

  if (message.event === "short:updated") {
    const data = message.data as { short?: T } | null;
    const short = data?.short;
    if (!short || typeof short.id !== "string") return null;
    const existingIndex = shorts.findIndex((candidate) => candidate.id === short.id);
    // Never insert from SSE/session metadata. New rows appear only after GET /shorts.
    if (existingIndex < 0) return null;
    return shorts.map((candidate, index) => index === existingIndex ? short : candidate);
  }

  return null;
}
