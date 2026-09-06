/**
 * Home (`#/`): read-only author header + cover bookshelf.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fetchJson, useApi } from "../hooks/use-api";
import { useEffect, useMemo, useState } from "react";
import { startFreshBookCreateSession } from "./chat-page-state";
import { useChatStore } from "../store/chat";
import { useServiceStore } from "../store/service";
import type { SSEMessage } from "../hooks/use-sse";
import type { TFunction } from "../hooks/use-i18n";
import { removeBookFromCollection, removeShortFromCollection, shouldRefetchBookCollections } from "../hooks/use-book-activity";
import { deleteStudioShortWork } from "../lib/short-api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DefaultCover } from "../components/DefaultCover";
import { selectWorksListShorts, type StudioShortSummary } from "../shared/short-works";
import { bookManuscriptExportPath, shortManuscriptExportPath } from "../lib/work-export";
import type { AuthorPublic } from "../lib/author-profile";
import { isInProgressBookStatus, isInProgressShortStatus, shelfEmptyCopy } from "../lib/stage-copy";
import { LiteraryEmpty } from "../components/LiteraryEmpty";
import { Pencil, ChevronRight, MoreHorizontal, FolderOpen, Download, Settings, Trash2, BarChart2, Feather } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly chaptersWritten: number;
  readonly targetChapters?: number;
  readonly createdAt?: string;
  readonly coverImagePath?: string;
}

interface Nav {
  toBook: (id: string) => void;
  toBookSettings: (id: string) => void;
  toAnalytics: (id: string) => void;
  toBookCreate: () => void;
  toServices: () => void;
  toAuthor: () => void;
  toShort: (id: string) => void;
  toShortSettings: (id: string) => void;
  toShortAnalytics: (id: string) => void;
}

export function Dashboard({ nav, sse, t }: {
  nav: Nav;
  sse: { messages: ReadonlyArray<SSEMessage> };
  theme?: unknown;
  t: TFunction;
}) {
  const isZh = t("nav.connected") === "已连接";
  const createDraftSession = useChatStore((s) => s.createDraftSession);
  const setInput = useChatStore((s) => s.setInput);
  const { data: author } = useApi<AuthorPublic>("/author");
  const { data, loading, error, refetch, mutate } = useApi<{ books: ReadonlyArray<BookSummary> }>("/books");
  const { data: shortsData, refetch: refetchShorts, mutate: mutateShorts } = useApi<{ shorts: ReadonlyArray<StudioShortSummary> }>("/shorts");
  const shorts = selectWorksListShorts(shortsData);
  const books = data?.books ?? [];
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);
  const bumpBookDataVersion = useChatStore((s) => s.bumpBookDataVersion);
  const fetchServices = useServiceStore((s) => s.fetchServices);
  const serviceStoreServices = useServiceStore((s) => s.services);
  const [bioOpen, setBioOpen] = useState(false);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [deleteBookTarget, setDeleteBookTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteShortTarget, setDeleteShortTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => { void fetchServices(); }, [fetchServices]);
  const hasServices = serviceStoreServices.some((s) => s.connected);

  useEffect(() => {
    const recent = sse.messages.at(-1);
    if (!recent) return;
    if (shouldRefetchBookCollections(recent)) {
      refetch();
      void refetchShorts();
    }
  }, [refetch, refetchShorts, sse.messages]);

  useEffect(() => {
    void refetch();
    void refetchShorts();
  }, [bookDataVersion, refetch, refetchShorts]);

  const inProgressBooks = useMemo(() => books.filter((book) => isInProgressBookStatus(book.status)), [books]);
  const pausedBooks = useMemo(() => books.filter((book) => book.status === "paused"), [books]);
  const completedBooks = useMemo(
    () => books.filter((book) => book.status === "completed" || book.status === "dropped"),
    [books],
  );
  const inProgressShorts = useMemo(() => shorts.filter((short) => isInProgressShortStatus(short.status)), [shorts]);
  const doneShorts = useMemo(() => shorts.filter((short) => !isInProgressShortStatus(short.status)), [shorts]);
  const archivedCount = pausedBooks.length + completedBooks.length + doneShorts.length;
  const hasWorks = books.length > 0 || shorts.length > 0;

  const authorName = author?.name?.trim() || t("nav.signYourName");
  const authorBio = author?.bio?.trim() ?? "";
  const avatarSrc = author?.hasAvatar
    ? `/api/v1/author/avatar${author.updatedAt ? `?v=${encodeURIComponent(author.updatedAt)}` : ""}`
    : "";
  const empty = shelfEmptyCopy(isZh);

  const openFreshBookCreate = () => {
    startFreshBookCreateSession(createDraftSession);
    setInput("");
    nav.toBookCreate();
  };

  const setBookStatus = async (book: BookSummary, status: "paused" | "active") => {
    try {
      await fetchJson(`/books/${book.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      bumpBookDataVersion();
      void refetch();
    } catch {
      void refetch();
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteBookTarget) return;
    const bookId = deleteBookTarget.id;
    mutate((current) => current ? { books: removeBookFromCollection(current.books, bookId) } : current);
    setDeleteBookTarget(null);
    try {
      await fetchJson(`/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
      bumpBookDataVersion();
    } catch {
      void refetch();
    }
  };

  const handleDeleteShort = async () => {
    if (!deleteShortTarget) return;
    const shortId = deleteShortTarget.id;
    mutateShorts((current) => current
      ? { shorts: removeShortFromCollection(current.shorts, shortId) }
      : current);
    setDeleteShortTarget(null);
    try {
      await deleteStudioShortWork(shortId);
      bumpBookDataVersion();
    } catch {
      void refetchShorts();
    }
  };

  if (loading && !data && shorts.length === 0 && !author) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-destructive">{t("common.error")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 fade-in" data-testid="home-page">
      {!hasServices && (
        <p className="text-sm text-muted-foreground">
          {t("home.noModel")}
          <span className="mx-1.5 text-border">·</span>
          {t("home.noModelHint")}
          <button type="button" onClick={nav.toServices} className="ml-2 text-primary hover:underline">
            {t("home.goConfigure")}
          </button>
        </p>
      )}

      <header className="flex items-start gap-5">
        <div className="group/avatar relative shrink-0">
          <button
            type="button"
            data-testid="home-author"
            onClick={() => {
              if (!author?.name?.trim()) nav.toAuthor();
            }}
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[oklch(0.36_0.07_160)] text-2xl text-[oklch(0.70_0.09_82)]"
          >
            {avatarSrc
              ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              : (author?.name?.trim().slice(0, 1) || "墨")}
          </button>
          <button
            type="button"
            data-testid="home-edit-author"
            onClick={nav.toAuthor}
            title={t("home.editAuthor")}
            className="absolute -right-1 -bottom-1 hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm group-hover/avatar:flex hover:text-foreground"
          >
            <Pencil size={14} />
            <span className="sr-only">{t("home.editAuthor")}</span>
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              if (!author?.name?.trim()) nav.toAuthor();
            }}
            className="font-serif text-[32px] leading-10 text-left"
          >
            {authorName}
          </button>
          {authorBio && (
            <div>
              <p className={`text-[15px] leading-7 text-muted-foreground ${bioOpen ? "" : "line-clamp-2"}`}>
                {authorBio}
              </p>
              {authorBio.length > 80 && (
                <button
                  type="button"
                  onClick={() => setBioOpen((open) => !open)}
                  className="mt-1 text-[13px] text-muted-foreground hover:text-foreground"
                >
                  {bioOpen ? t("home.collapseBio") : `…${t("home.expandBio")}`}
                </button>
              )}
            </div>
          )}
          <p className="text-[13px] text-muted-foreground">
            {isZh
              ? `在创 ${inProgressBooks.length + inProgressShorts.length} · 暂停 ${pausedBooks.length} · 完结 ${completedBooks.length + doneShorts.filter((s) => s.status === "completed").length}`
              : `${inProgressBooks.length + inProgressShorts.length} active · ${pausedBooks.length} paused · ${completedBooks.length + doneShorts.filter((s) => s.status === "completed").length} done`}
          </p>
        </div>
      </header>

      <div className="h-px bg-[oklch(0.70_0.09_82_/_0.45)]" />

      {!hasWorks ? (
        <LiteraryEmpty
          title={empty.title}
          subtitle={empty.subtitle}
          action={empty.action}
          onAction={openFreshBookCreate}
          testId="shelf-empty"
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-[16px] font-bold tracking-[0.1em] text-muted-foreground">{t("home.inProgress")}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="home-shelf-active">
              {inProgressBooks.map((book) => (
                <HomeBookCard
                  key={book.id}
                  book={book}
                  nav={nav}
                  t={t}
                  isZh={isZh}
                  onPause={() => void setBookStatus(book, "paused")}
                  onDelete={() => setDeleteBookTarget({ id: book.id, title: book.title })}
                />
              ))}
              {inProgressShorts.map((short) => (
                <HomeShortCard
                  key={`short-${short.id}`}
                  short={short}
                  nav={nav}
                  t={t}
                  onDelete={() => setDeleteShortTarget({ id: short.id, title: short.title })}
                />
              ))}
            </div>
            {inProgressBooks.length === 0 && inProgressShorts.length === 0 && (
              <p className="text-sm text-muted-foreground italic">{t("dash.noBooks")}</p>
            )}
          </section>

          {archivedCount > 0 && (
            <section className="space-y-3">
              <button
                type="button"
                data-testid="home-shelf-archived-toggle"
                onClick={() => setPausedOpen((open) => !open)}
                className="flex items-center gap-1.5 text-[16px] font-bold tracking-[0.1em] text-muted-foreground hover:text-foreground"
              >
                <ChevronRight size={15} className={pausedOpen ? "rotate-90" : ""} />
                {t("home.pausedCompleted")}
              </button>
              {pausedOpen && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="home-shelf-archived">
                  {pausedBooks.map((book) => (
                    <HomeBookCard
                      key={book.id}
                      book={book}
                      nav={nav}
                      t={t}
                      isZh={isZh}
                      onResume={() => void setBookStatus(book, "active")}
                      onDelete={() => setDeleteBookTarget({ id: book.id, title: book.title })}
                    />
                  ))}
                  {completedBooks.map((book) => (
                    <HomeBookCard
                      key={book.id}
                      book={book}
                      nav={nav}
                      t={t}
                      isZh={isZh}
                      onResume={() => void setBookStatus(book, "active")}
                      onDelete={() => setDeleteBookTarget({ id: book.id, title: book.title })}
                    />
                  ))}
                  {doneShorts.map((short) => (
                    <HomeShortCard
                      key={`short-${short.id}`}
                      short={short}
                      nav={nav}
                      t={t}
                      onDelete={() => setDeleteShortTarget({ id: short.id, title: short.title })}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteBookTarget !== null}
        title={t("book.deleteBook")}
        message={`${t("book.confirmDelete")}\n\n"${deleteBookTarget?.title ?? ""}"`}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={() => void handleDeleteBook()}
        onCancel={() => setDeleteBookTarget(null)}
      />
      <ConfirmDialog
        open={deleteShortTarget !== null}
        title={t("short.delete")}
        message={`${t("short.confirmDelete")}\n\n"${deleteShortTarget?.title ?? ""}"`}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onConfirm={() => void handleDeleteShort()}
        onCancel={() => setDeleteShortTarget(null)}
      />
    </div>
  );
}

function HomeBookCard({
  book,
  nav,
  t,
  isZh,
  onPause,
  onResume,
  onDelete,
}: {
  readonly book: BookSummary;
  readonly nav: Nav;
  readonly t: TFunction;
  readonly isZh: boolean;
  readonly onPause?: () => void;
  readonly onResume?: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <div className="group/cover relative" data-testid={`home-book-${book.id}`}>
      <button type="button" onClick={() => nav.toBook(book.id)} className="w-full text-left">
        <DefaultCover
          title={book.title}
          createdAt={book.createdAt}
          written={book.chaptersWritten}
          target={book.targetChapters ?? 0}
          coverSrc={book.coverImagePath}
        />
        <span className="mt-1.5 block truncate text-[13px] leading-5">{book.title}</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {book.chaptersWritten}/{book.targetChapters ?? "—"}
        </span>
        <span data-testid={`dashboard-book-badge-${book.id}`} className="sr-only">{t("book.badgeLong")}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid={`home-book-menu-${book.id}`}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-background/80 opacity-0 group-hover/cover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-40">
          <DropdownMenuItem onClick={() => nav.toBook(book.id)}>
            <FolderOpen size={14} />
            <span>{t("cockpit.title")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid={`book-export-manuscript-${book.id}`}
            onClick={() => {
              const link = document.createElement("a");
              link.href = bookManuscriptExportPath(book.id);
              link.download = "";
              link.click();
            }}
          >
            <Download size={14} />
            <span>{t("book.export")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => nav.toBookSettings(book.id)}>
            <Settings size={14} />
            <span>{t("book.settings")}</span>
          </DropdownMenuItem>
          {onPause && (
            <DropdownMenuItem onClick={onPause}>
              <span>{t("home.pause")}</span>
            </DropdownMenuItem>
          )}
          {onResume && (
            <DropdownMenuItem onClick={onResume}>
              <span>{t("home.resume")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" data-testid={`home-book-delete-${book.id}`} onClick={onDelete}>
            <Trash2 size={14} />
            <span>{t("book.deleteBook")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only">{isZh ? "长篇" : "Long"}</span>
    </div>
  );
}

function HomeShortCard({
  short,
  nav,
  t,
  onDelete,
}: {
  readonly short: StudioShortSummary;
  readonly nav: Nav;
  readonly t: TFunction;
  readonly onDelete: () => void;
}) {
  return (
    <div className="group/cover relative" data-testid={`dashboard-short-${short.id}`}>
      <button type="button" onClick={() => nav.toShort(short.id)} className="w-full text-left">
        <DefaultCover
          title={short.title}
          coverSrc={short.coverImagePath}
          written={short.chapterCount ?? 0}
          target={short.chapterCount ?? 1}
        />
        <span className="mt-1.5 block truncate text-[13px] leading-5">{short.title}</span>
        <span
          data-testid={`dashboard-short-badge-${short.id}`}
          className="absolute left-1 top-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
        >
          {t("short.badge")}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid={`home-short-menu-${short.id}`}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-background/80 opacity-0 group-hover/cover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-40">
          <DropdownMenuItem onClick={() => nav.toShort(short.id)}>
            <Feather size={14} />
            <span>{short.status === "completed" ? t("short.finished") : t("dash.writeNext")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid={`short-settings-${short.id}`} onClick={() => nav.toShortSettings(short.id)}>
            <Settings size={14} />
            <span>{t("book.settings")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem data-testid={`short-stats-${short.id}`} onClick={() => nav.toShortAnalytics(short.id)}>
            <BarChart2 size={14} />
            <span>{t("dash.stats")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid={`short-export-manuscript-${short.id}`}
            onClick={() => {
              const link = document.createElement("a");
              link.href = shortManuscriptExportPath(short.id);
              link.download = "";
              link.click();
            }}
          >
            <Download size={14} />
            <span>{t("book.export")}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" data-testid={`short-delete-${short.id}`} onClick={onDelete}>
            <Trash2 size={14} />
            <span>{t("book.deleteBook")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
