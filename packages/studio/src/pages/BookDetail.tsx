import { fetchJson, useApi, postApi } from "../hooks/use-api";
import { useEffect, useMemo, useState } from "react";
import { SerialCockpitStrip, startDraft, startWriteNext } from "../components/SerialCockpitStrip";
import { BookWorkspaceNav } from "../components/BookWorkspaceNav";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import { deriveBookActivity, shouldRefetchBookView } from "../hooks/use-book-activity";
import { bookManuscriptExportPath } from "../lib/work-export";
import { hasPreviousChapterUnapprovedReason, isMustFixSeverity, mapAuditCategory, mapAuditSeverity } from "../lib/copy-map";
import { writeEmptyCopy } from "../lib/stage-copy";
import type { BookStageSnapshot } from "../lib/book-stage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  ChevronLeft,
  Feather,
  FileText,
  Download,
  Eye,
  Check,
  X,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  Settings2
} from "lucide-react";

interface ChapterMeta {
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly wordCount: number;
}

interface BookData {
  readonly book: {
    readonly id: string;
    readonly title: string;
    readonly genre: string;
    readonly status: string;
    readonly chapterWordCount: number;
    readonly targetChapters?: number;
    readonly language?: string;
    readonly fanficMode?: string;
  };
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly nextChapter: number;
}

type ReviseMode = "spot-fix" | "polish" | "rewrite" | "rework" | "anti-detect";
type ExportFormat = "txt" | "md" | "epub";

interface Nav {
  toDashboard: () => void;
  toBook: (bookId: string) => void;
  toOutline: (bookId: string) => void;
  toBookChat: (bookId: string) => void;
  toBookSettings: (bookId: string) => void;
  toChapter: (bookId: string, num: number) => void;
  toAnalytics: (bookId: string) => void;
  toTruth: (bookId: string) => void;
}

function translateChapterStatus(status: string, t: TFunction): string {
  const map: Record<string, () => string> = {
    "ready-for-review": () => t("chapter.readyForReview"),
    "approved": () => t("chapter.approved"),
    "drafted": () => t("chapter.drafted"),
    "needs-revision": () => t("chapter.needsRevision"),
    "imported": () => t("chapter.imported"),
    "audit-failed": () => t("chapter.auditFailed"),
  };
  return map[status]?.() ?? status;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  "ready-for-review": { color: "text-amber-500 bg-amber-500/10", icon: <Eye size={12} /> },
  approved: { color: "text-emerald-500 bg-emerald-500/10", icon: <Check size={12} /> },
  drafted: { color: "text-muted-foreground bg-muted/20", icon: <FileText size={12} /> },
  "needs-revision": { color: "text-destructive bg-destructive/10", icon: <RotateCcw size={12} /> },
  imported: { color: "text-blue-500 bg-blue-500/10", icon: <Download size={12} /> },
};

export function BookDetail({
  bookId,
  nav,
  theme: _theme,
  t,
  sse,
}: {
  bookId: string;
  nav: Nav;
  theme: Theme;
  t: TFunction;
  sse: { messages: ReadonlyArray<SSEMessage> };
}) {
  const { data, loading, error, refetch } = useApi<BookData>(`/books/${bookId}`);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [writeRequestPending, setWriteRequestPending] = useState(false);
  const [draftRequestPending, setDraftRequestPending] = useState(false);
  const [stage, setStage] = useState<BookStageSnapshot | null>(null);
  const [rewritingChapters, setRewritingChapters] = useState<ReadonlyArray<number>>([]);
  const [revisingChapters, setRevisingChapters] = useState<ReadonlyArray<number>>([]);
  const [syncingChapters, setSyncingChapters] = useState<ReadonlyArray<number>>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");
  const [exportApprovedOnly, setExportApprovedOnly] = useState(false);
  const [bookActionPending, setBookActionPending] = useState<string | null>(null);
  // Auto (pipeline self-reviews) vs manual (write the draft and stop; you
  // run audit / revise / approve as checkpoint actions). This is scoped to
  // the current book, with project-level mode as the inherited default.
  const [reviewMode, setReviewMode] = useState<"auto" | "manual">("auto");
  const [skipPreviousApproval, setSkipPreviousApproval] = useState(false);
  const [preflight, setPreflight] = useState<{ ok: boolean; reasons: Array<{ code?: string; message?: string; messageZh?: string; chapterNumber?: number }> } | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReadonlyArray<{
    chapterNumber: number;
    severity: string;
    category: string;
    description: string;
  }>>([]);
  useEffect(() => {
    void fetchJson<{ mode?: string }>(`/books/${encodeURIComponent(bookId)}/chapter-review-mode`)
      .then((r) => setReviewMode(r.mode === "manual" ? "manual" : "auto"))
      .catch(() => undefined);
  }, [bookId]);
  const activity = useMemo(() => deriveBookActivity(sse.messages, bookId), [bookId, sse.messages]);
  const writing = writeRequestPending || activity.writing;
  const drafting = draftRequestPending || activity.drafting;
  const latestPersistedChapter = data ? data.nextChapter - 1 : 0;

  useEffect(() => {
    const recent = sse.messages.at(-1);
    if (!recent) return;

    const data = recent.data as { bookId?: string } | null;
    if (data?.bookId !== bookId) return;

    if (recent.event === "write:start") {
      setWriteRequestPending(false);
      return;
    }

    if (recent.event === "draft:start") {
      setDraftRequestPending(false);
      return;
    }

    if (shouldRefetchBookView(recent, bookId)) {
      setWriteRequestPending(false);
      setDraftRequestPending(false);
      refetch();
    }
  }, [bookId, refetch, sse.messages]);

  useEffect(() => {
    const query = skipPreviousApproval ? "?skipPreviousApproval=1" : "";
    void fetchJson<{ ok: boolean; reasons?: Array<{ code?: string; message?: string; messageZh?: string; chapterNumber?: number }> }>(`/books/${bookId}/write-preflight${query}`)
      .then((body) => setPreflight({ ok: body.ok, reasons: body.reasons ?? [] }))
      .catch(() => setPreflight({ ok: true, reasons: [] }));
    void fetchJson<{ items?: Array<{ chapterNumber: number; severity: string; category: string; description: string }> }>(`/books/${bookId}/review-queue`)
      .then((body) => setReviewQueue(body.items ?? []))
      .catch(() => setReviewQueue([]));
    void fetchJson<BookStageSnapshot>(`/books/${bookId}/stage`)
      .then(setStage)
      .catch(() => setStage(null));
  }, [bookId, skipPreviousApproval, data?.nextChapter, activity.lastError]);

  const handleWriteNext = async () => {
    setWriteRequestPending(true);
    try {
      await startWriteNext(bookId, skipPreviousApproval);
    } catch (e) {
      setWriteRequestPending(false);
      setActionMessage(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDraft = async () => {
    setDraftRequestPending(true);
    try {
      await startDraft(bookId, skipPreviousApproval);
    } catch (e) {
      setDraftRequestPending(false);
      setActionMessage(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleToggleReviewMode = async () => {
    const next = reviewMode === "manual" ? "auto" : "manual";
    setReviewMode(next);
    try {
      await fetchJson(`/books/${encodeURIComponent(bookId)}/chapter-review-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
    } catch {
      setReviewMode(reviewMode); // revert on failure
    }
  };

  const handleRewrite = async (chapterNum: number) => {
    const brief = window.prompt(
      data?.book.language === "en"
        ? "Optional rewrite brief for this run only. Leave blank to use existing focus."
        : "可选：输入这次重写要遵循的补充想法。留空则沿用现有 focus。",
      "",
    );
    if (brief === null) return;
    setRewritingChapters((prev) => [...prev, chapterNum]);
    try {
      await fetchJson(`/books/${bookId}/rewrite/${chapterNum}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() || undefined }),
      });
      refetch();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewritingChapters((prev) => prev.filter((n) => n !== chapterNum));
    }
  };

  const handleRevise = async (chapterNum: number, mode: ReviseMode) => {
    const brief = window.prompt(
      data?.book.language === "en"
        ? "Optional revise brief for this run only. Leave blank to use existing focus."
        : "可选：输入这次修订要遵循的补充想法。留空则沿用现有 focus。",
      "",
    );
    if (brief === null) return;
    setRevisingChapters((prev) => [...prev, chapterNum]);
    try {
      await fetchJson(`/books/${bookId}/revise/${chapterNum}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, brief: brief.trim() || undefined }),
      });
      refetch();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Revision failed");
    } finally {
      setRevisingChapters((prev) => prev.filter((n) => n !== chapterNum));
    }
  };

  const handleSync = async (chapterNum: number) => {
    const brief = window.prompt(
      data?.book.language === "en"
        ? "Optional sync brief for interpreting the edited chapter body. Leave blank to sync directly from the text."
        : "可选：输入这次同步时要遵循的补充说明。留空则直接按正文同步。",
      "",
    );
    if (brief === null) return;
    setSyncingChapters((prev) => [...prev, chapterNum]);
    try {
      await fetchJson(`/books/${bookId}/resync/${chapterNum}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() || undefined }),
      });
      refetch();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingChapters((prev) => prev.filter((n) => n !== chapterNum));
    }
  };

  const handleApproveAll = async () => {
    if (!data) return;
    const reviewable = data.chapters.filter((ch) => ch.status === "ready-for-review");
    let failed = 0;
    for (const chapter of reviewable) {
      try {
        await postApi(`/books/${bookId}/chapters/${chapter.number}/approve`, {});
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/critical|须处理|APPROVE_BLOCKED/i.test(message) || /APPROVE_BLOCKED/.test(String(error))) {
          const why = window.prompt(
            data?.book.language === "en"
              ? `Chapter ${chapter.number} still has must-fix issues. Type an override reason or cancel.`
              : `第 ${chapter.number} 章仍有须处理的问题。输入带病定稿原因，或取消。`,
            "",
          );
          if (!why?.trim()) {
            failed += 1;
            continue;
          }
          try {
            await postApi(`/books/${bookId}/chapters/${chapter.number}/approve`, {
              override: { who: "author", why: why.trim() },
            });
            continue;
          } catch {
            failed += 1;
            continue;
          }
        }
        failed += 1;
      }
    }
    if (failed > 0) {
      setActionMessage(`${failed}/${reviewable.length} approve(s) failed`);
    }
    refetch();
  };

  const runBookAction = async (key: string, action: () => Promise<string>) => {
    setBookActionPending(key);
    try {
      setActionMessage(await action());
      refetch();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBookActionPending(null);
    }
  };

  const handleRepairState = async (chapterNum: number) => {
    await runBookAction(`repair-state-${chapterNum}`, async () => {
      await fetchJson(`/books/${bookId}/repair-state/${chapterNum}`, { method: "POST" });
      return data?.book.language === "en" ? `Chapter ${chapterNum} state repaired.` : `第 ${chapterNum} 章状态已修复。`;
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
    </div>
  );

  if (error) return <div className="text-destructive p-8 bg-destructive/5 rounded-xl border border-destructive/20">Error: {error}</div>;
  if (!data) return null;

  const { book, chapters } = data;
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.wordCount ?? 0), 0);
  const reviewCount = chapters.filter((ch) => ch.status === "ready-for-review").length;

  const preflightOk = preflight?.ok !== false;
  const showSkip = hasPreviousChapterUnapprovedReason(preflight?.reasons ?? []);
  const isZh = book.language !== "en";
  const emptyCopy = writeEmptyCopy({
    hasOutline: stage?.stage === "write" || Boolean(stage?.steps.weave === "done"),
    previousUnapproved: showSkip ? (preflight?.reasons.find((reason) => reason.chapterNumber)?.chapterNumber) : undefined,
    isZh,
  });

  const exportHref = bookManuscriptExportPath(bookId, exportFormat, exportApprovedOnly);

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <button
          onClick={nav.toDashboard}
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <ChevronLeft size={14} />
          {t("bread.books")}
        </button>
        <span className="text-border">/</span>
        <button type="button" onClick={() => nav.toBook(bookId)} className="hover:text-primary">
          {book.title}
        </button>
        <span className="text-border">/</span>
        <span className="text-foreground">{isZh ? "落笔" : "Write"}</span>
      </nav>
      <BookWorkspaceNav bookId={bookId} active="write" nav={nav} isZh={isZh} t={t} />
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/40 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-serif font-medium">{book.title}</h1>
            {book.language === "en" && (
              <span className="px-1.5 py-0.5 rounded border border-primary/20 text-primary text-[10px] font-bold">EN</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground font-medium">
            <span className="px-2 py-0.5 rounded bg-secondary/50 text-foreground/70 text-xs">{book.genre}</span>
            <div className="flex items-center gap-1.5">
              <FileText size={14} />
              <span>{chapters.length} {t("dash.chapters")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Feather size={14} />
              <span>{totalWords.toLocaleString()} {t("book.words")}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/50 px-4 py-2.5 text-sm font-medium">
              <Download size={14} />
              {t("book.exportMenu")}
              <ChevronDown size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 space-y-2">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-xs"
              >
                <option value="txt">TXT</option>
                <option value="md">MD</option>
                <option value="epub">EPUB</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={exportApprovedOnly} onChange={(e) => setExportApprovedOnly(e.target.checked)} />
                {t("book.approvedOnly")}
              </label>
              <a href={exportHref} download data-testid="book-export-manuscript" className="block rounded-md px-2 py-1.5 text-xs hover:bg-secondary">
                {t("book.export")}
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const exported = await fetchJson<{ path?: string; chapters?: number }>(`/books/${bookId}/export-save`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ format: exportFormat, approvedOnly: exportApprovedOnly }),
                    });
                    setBookActionPending(`saved:${exported.path ?? ""}`);
                  } catch (e) {
                    setBookActionPending(e instanceof Error ? e.message : "Export failed");
                  }
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary"
              >
                {t("book.exportSave")}
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="inline-flex overflow-hidden rounded-xl bg-primary text-primary-foreground">
            <button
              type="button"
              onClick={handleWriteNext}
              disabled={writing || drafting || !preflightOk}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-50"
              data-testid="write-next-primary"
            >
              {writing ? <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" /> : <Feather size={16} />}
              {writing ? t("dash.writing") : t("cockpit.writeNext")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="border-l border-primary-foreground/20 px-2">
                <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleDraft()}>{t("book.draftOnly")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleToggleReviewMode()}>
                  {reviewMode === "manual" ? t("book.reviewManual") : t("book.reviewAuto")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <SerialCockpitStrip
        bookId={bookId}
        isZh={isZh}
        skipPreviousApproval={skipPreviousApproval}
        onSkipChange={setSkipPreviousApproval}
        showSkip={showSkip}
        onJumpOutline={() => nav.toOutline(bookId)}
        onJumpReview={(chapterNumber) => {
          if (chapterNumber) nav.toChapter(bookId, chapterNumber);
        }}
      />

      {reviewQueue.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-2" data-testid="review-queue">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{isZh ? "等你过目" : "Review queue"}</div>
            {reviewCount > 0 && (
              <button type="button" onClick={handleApproveAll} className="text-xs font-medium text-emerald-600">
                {t("book.approveAll")} ({reviewCount})
              </button>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            {reviewQueue.slice(0, 12).map((item, index) => (
              <li key={`${item.chapterNumber}-${item.category}-${index}`}>
                <span className={isMustFixSeverity(item.severity) ? "text-destructive font-medium" : "text-muted-foreground"}>
                  {mapAuditSeverity(item.severity, isZh)}
                </span>{" "}
                {isZh ? "第" : "Ch."}{item.chapterNumber} · {mapAuditCategory(item.category, isZh)}: {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(writing || drafting || activity.lastError || actionMessage || (typeof bookActionPending === "string" && bookActionPending.startsWith("saved:"))) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            activity.lastError
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-primary/20 bg-primary/[0.04] text-foreground"
          }`}
        >
          {activity.lastError ? (
            <span>{t("book.pipelineFailed")}: {activity.lastError}</span>
          ) : writing ? (
            <span>{t("book.pipelineWriting")}</span>
          ) : drafting ? (
            <span>{t("book.pipelineDrafting")}</span>
          ) : actionMessage ? (
            <span className="whitespace-pre-wrap">{actionMessage}</span>
          ) : (
            <span>{t("common.exportSuccess")}</span>
          )}
        </div>
      )}

      {/* Chapters Table */}
      <div className="paper-sheet rounded-2xl overflow-hidden border border-border/40 shadow-xl shadow-primary/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="text-left px-6 py-4 font-bold text-[11px]  text-muted-foreground w-16">#</th>
                <th className="text-left px-6 py-4 font-bold text-[11px]  text-muted-foreground">{t("book.manuscriptTitle")}</th>
                <th className="text-left px-6 py-4 font-bold text-[11px]  text-muted-foreground w-28">{t("book.words")}</th>
                <th className="text-left px-6 py-4 font-bold text-[11px]  text-muted-foreground w-36">{t("book.status")}</th>
                <th className="text-right px-6 py-4 font-bold text-[11px]  text-muted-foreground">{t("book.curate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {chapters.map((ch, index) => {
                const staggerClass = `stagger-${Math.min(index + 1, 5)}`;
                return (
                <tr key={ch.number} className={`group hover:bg-primary/[0.02] transition-colors fade-in ${staggerClass}`}>
                  <td className="px-6 py-4 text-muted-foreground/60 font-mono text-xs">{ch.number.toString().padStart(2, '0')}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => nav.toChapter(bookId, ch.number)}
                      className="font-serif text-lg font-medium hover:text-primary transition-colors text-left"
                    >
                      {ch.title || t("chapter.label").replace("{n}", String(ch.number))}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-medium tabular-nums text-xs">{(ch.wordCount ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${STATUS_CONFIG[ch.status]?.color ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_CONFIG[ch.status]?.icon}
                      {translateChapterStatus(ch.status, t)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {ch.status === "ready-for-review" && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                await postApi(`/books/${bookId}/chapters/${ch.number}/approve`, {});
                                refetch();
                              } catch (e) {
                                const why = window.prompt(
                                  data?.book.language === "en"
                                    ? "Must-fix issues block approve. Type override reason or cancel."
                                    : "须处理的问题阻止通过。输入带病定稿原因，或取消。",
                                  "",
                                );
                                if (!why?.trim()) {
                                  setActionMessage(e instanceof Error ? e.message : "Approve failed");
                                  return;
                                }
                                try {
                                  await postApi(`/books/${bookId}/chapters/${ch.number}/approve`, {
                                    override: { who: "author", why: why.trim() },
                                  });
                                  refetch();
                                } catch (retry) {
                                  setActionMessage(retry instanceof Error ? retry.message : "Approve failed");
                                }
                              }
                            }}
                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            title={t("book.approve")}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              try { await postApi(`/books/${bookId}/chapters/${ch.number}/reject`); refetch(); }
                              catch (e) { setActionMessage(e instanceof Error ? e.message : "Reject failed"); }
                            }}
                            className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm"
                            title={data?.book.language === "en" ? "Rollback this chapter" : "回滚本章"}
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            const auditResult = await fetchJson<{ passed?: boolean; issues?: unknown[] }>(`/books/${bookId}/audit/${ch.number}`, { method: "POST" });
                            setActionMessage(auditResult.passed
                              ? (isZh ? "审校已通过" : "Audit passed")
                              : (isZh ? `审校未过：${auditResult.issues?.length ?? 0} 条` : `Audit failed: ${auditResult.issues?.length ?? 0} issues`));
                            refetch();
                          } catch (e) {
                            setActionMessage(e instanceof Error ? e.message : "Audit failed");
                          }
                        }}
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shadow-sm"
                        title={t("book.audit")}
                      >
                        <ShieldCheck size={14} />
                      </button>
                      <button
                        onClick={() => handleRewrite(ch.number)}
                        disabled={rewritingChapters.includes(ch.number)}
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shadow-sm disabled:opacity-50"
                        title={t("book.rewrite")}
                      >
                        {rewritingChapters.includes(ch.number)
                          ? <div className="w-3.5 h-3.5 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
                          : <RotateCcw size={14} />}
                      </button>
                      <button
                        onClick={() => handleSync(ch.number)}
                        disabled={syncingChapters.includes(ch.number) || ch.number !== latestPersistedChapter}
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shadow-sm disabled:opacity-50"
                        title={data?.book.language === "en" ? "Sync truth/state from edited chapter" : "根据已编辑章节同步 truth/state"}
                      >
                        {syncingChapters.includes(ch.number)
                          ? <div className="w-3.5 h-3.5 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
                          : <RefreshCw size={14} />}
                      </button>
                      {ch.status === "state-degraded" && (
                        <button
                          onClick={() => handleRepairState(ch.number)}
                          disabled={bookActionPending === `repair-state-${ch.number}`}
                          className="p-2 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                          title={t("book.repairState")}
                        >
                          {bookActionPending === `repair-state-${ch.number}`
                            ? <div className="w-3.5 h-3.5 border-2 border-amber-600/20 border-t-amber-600 rounded-full animate-spin" />
                            : <Settings2 size={14} />}
                        </button>
                      )}
                      <select
                        disabled={revisingChapters.includes(ch.number)}
                        value=""
                        onChange={(e) => {
                          const mode = e.target.value as ReviseMode;
                          if (mode) handleRevise(ch.number, mode);
                        }}
                        className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-secondary text-muted-foreground border border-border/50 outline-none hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50 cursor-pointer"
                        title="Revise with AI"
                      >
                        <option value="" disabled>{revisingChapters.includes(ch.number) ? t("common.loading") : t("book.curate")}</option>
                        <option value="spot-fix">{t("book.spotFix")}</option>
                        <option value="polish">{t("book.polish")}</option>
                        <option value="rewrite">{t("book.rewrite")}</option>
                        <option value="rework">{t("book.rework")}</option>
                        <option value="anti-detect">{t("book.antiDetect")}</option>
                      </select>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {chapters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="write-empty">
            <p className="font-serif text-lg">{emptyCopy.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{emptyCopy.subtitle}</p>
            {emptyCopy.target === "weave" && (
              <button type="button" onClick={() => nav.toOutline(bookId)} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {emptyCopy.action}
              </button>
            )}
            {emptyCopy.target === "write" && Boolean(showSkip) && (
              <button
                type="button"
                onClick={() => {
                  const chapter = preflight?.reasons.find((reason) => reason.chapterNumber)?.chapterNumber;
                  if (chapter) nav.toChapter(bookId, chapter);
                }}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {emptyCopy.action}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
