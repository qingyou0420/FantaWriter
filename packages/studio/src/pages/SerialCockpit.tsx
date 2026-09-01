/**
 * Daily home after opening a book: next chapter, volume OKR, hooks,
 * last-chapter status, one 落墨 action, G3 proposals, G5 review shortcut.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fetchJson, useApi } from "../hooks/use-api";
import { useEffect, useMemo, useState } from "react";
import { BookWorkspaceNav, type BookWorkspaceNavTarget } from "../components/BookWorkspaceNav";
import { SerialCockpitStrip, startWriteNext } from "../components/SerialCockpitStrip";
import type { WritePreflightEvaluation } from "../components/SerialCockpitStrip";
import { TruthProposalCard, type PendingTruthProposal } from "../components/TruthProposalCard";
import { assembleCockpitSnapshot, type CockpitDueHook, type CockpitReviewItem } from "../lib/serial-cockpit";
import { deriveBookActivity, shouldRefetchBookView } from "../hooks/use-book-activity";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import {
  ChevronLeft,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Feather,
  ListTree,
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
    readonly language?: string;
  };
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly nextChapter: number;
}

interface Nav extends BookWorkspaceNavTarget {
  toDashboard: () => void;
  toChapter: (bookId: string, num: number) => void;
  toTruth: (bookId: string) => void;
}

function statusLabel(status: string, isZh: boolean): string {
  const map: Record<string, [string, string]> = {
    "ready-for-review": ["待审稿", "ready for review"],
    approved: ["已通过", "approved"],
    "audit-failed": ["审计失败", "audit failed"],
    drafted: ["草稿", "drafted"],
    "needs-revision": ["需修订", "needs revision"],
    imported: ["已导入", "imported"],
    "state-degraded": ["状态降级", "state degraded"],
  };
  const pair = map[status];
  return pair ? (isZh ? pair[0] : pair[1]) : status;
}

export function SerialCockpit({
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
  const [skipPreviousApproval, setSkipPreviousApproval] = useState(false);
  const [preflight, setPreflight] = useState<WritePreflightEvaluation | null>(null);
  const [hooks, setHooks] = useState<ReadonlyArray<CockpitDueHook>>([]);
  const [reviewQueue, setReviewQueue] = useState<ReadonlyArray<CockpitReviewItem>>([]);
  const [proposals, setProposals] = useState<ReadonlyArray<PendingTruthProposal>>([]);
  const [volumeMap, setVolumeMap] = useState("");
  const [writePending, setWritePending] = useState(false);

  const activity = useMemo(() => deriveBookActivity(sse.messages, bookId), [bookId, sse.messages]);
  const writing = writePending || activity.writing;
  const isZh = data?.book.language !== "en";

  const refreshAux = () => {
    const query = skipPreviousApproval ? "?skipPreviousApproval=1" : "";
    void fetchJson<WritePreflightEvaluation>(`/books/${bookId}/write-preflight${query}`)
      .then(setPreflight)
      .catch(() => setPreflight(null));
    void fetchJson<{ hooks?: CockpitDueHook[] }>(`/books/${bookId}/hooks/due`)
      .then((body) => setHooks(body.hooks ?? []))
      .catch(() => setHooks([]));
    void fetchJson<{ items?: CockpitReviewItem[] }>(`/books/${bookId}/review-queue`)
      .then((body) => setReviewQueue(body.items ?? []))
      .catch(() => setReviewQueue([]));
    void fetchJson<{ proposals?: PendingTruthProposal[] }>(`/books/${bookId}/truth-proposals`)
      .then((body) => setProposals(body.proposals ?? []))
      .catch(() => setProposals([]));
    void fetchJson<{ content?: string | null }>(`/books/${bookId}/truth/outline/volume_map.md`)
      .then((body) => setVolumeMap(body.content ?? ""))
      .catch(() => setVolumeMap(""));
  };

  useEffect(() => {
    refreshAux();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, skipPreviousApproval, data?.nextChapter]);

  useEffect(() => {
    const recent = sse.messages.at(-1);
    if (!recent) return;
    if (shouldRefetchBookView(recent, bookId)) {
      setWritePending(false);
      refetch();
      refreshAux();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, refetch, sse.messages]);

  const snapshot = useMemo(() => {
    if (!data || !preflight) return null;
    return assembleCockpitSnapshot({
      chapters: data.chapters,
      nextChapter: data.nextChapter,
      volumeMap,
      preflight,
      dueHooks: hooks,
      reviewQueue,
      pendingProposals: proposals,
      skipPreviousApproval,
      isZh,
    });
  }, [data, preflight, volumeMap, hooks, reviewQueue, proposals, skipPreviousApproval, isZh]);

  const handleWriteNext = async () => {
    if (!snapshot?.writeNext.enabled) {
      nav.toOutline(bookId);
      return;
    }
    setWritePending(true);
    try {
      await startWriteNext(bookId, skipPreviousApproval);
    } catch (err) {
      setWritePending(false);
      alert(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
      </div>
    );
  }
  if (error) return <div className="text-destructive p-8">Error: {error}</div>;
  if (!data) return null;

  const book = data.book;

  return (
    <div className="space-y-6 fade-in" data-testid="serial-cockpit-home">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <button type="button" onClick={nav.toDashboard} className="hover:text-primary flex items-center gap-1">
            <ChevronLeft size={14} />
            {t("bread.books")}
          </button>
          <span className="text-border">/</span>
          <span className="text-foreground">{book.title}</span>
        </nav>
        <BookWorkspaceNav bookId={bookId} active="cockpit" nav={nav} isZh={isZh} />
      </div>

      <header className="space-y-1 border-b border-border/40 pb-6">
        <h1 className="font-serif text-4xl font-medium">{book.title}</h1>
        <p className="text-sm text-muted-foreground">{isZh ? "连载驾驶舱 · 今天写哪一章" : "Serialization cockpit"}</p>
      </header>

      {snapshot && (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-5 space-y-3" data-testid="cockpit-next-chapter">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {isZh ? "下一章" : "Next chapter"}
          </div>
          <div className="font-serif text-3xl">
            {isZh ? `第 ${snapshot.nextChapter.number} 章` : `Chapter ${snapshot.nextChapter.number}`}
            {snapshot.nextChapter.title ? ` · ${snapshot.nextChapter.title}` : ""}
          </div>
          {snapshot.nextChapter.volumePosition && (
            <div className="text-sm text-muted-foreground">{snapshot.nextChapter.volumePosition}</div>
          )}
          {snapshot.nextChapter.oneLine && (
            <p className="text-sm leading-6 text-foreground/80">{snapshot.nextChapter.oneLine}</p>
          )}
        </section>
      )}

      {snapshot?.volume && (
        <section className="rounded-2xl border border-border/40 px-5 py-4 space-y-2" data-testid="cockpit-volume-okr">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{snapshot.volume.name}</div>
            <div className="text-xs text-muted-foreground">{snapshot.volume.progressLabel}</div>
          </div>
          {snapshot.volume.okr && (
            <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{snapshot.volume.okr}</p>
          )}
        </section>
      )}

      {snapshot && snapshot.dueHooks.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 space-y-2" data-testid="cockpit-hooks">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock size={14} />
            {isZh ? "到期 / 逾期伏笔" : "Due / overdue hooks"}
          </div>
          <ul className="space-y-1 text-sm">
            {snapshot.dueHooks.map((hook) => (
              <li key={hook.hookId} className={hook.dueState === "overdue" ? "text-destructive" : "text-amber-700"}>
                {hook.hookId}
                {hook.targetChapter ? ` · ${isZh ? "目标章" : "target"} ${hook.targetChapter}` : ""}
                {hook.dueState === "overdue" ? (isZh ? "（逾期）" : " (overdue)") : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot?.lastChapter && (
        <section className="rounded-2xl border border-border/40 px-5 py-4 flex flex-wrap items-center justify-between gap-3" data-testid="cockpit-last-chapter">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {isZh ? "上一章" : "Last chapter"}
            </div>
            <div className="text-sm font-medium">
              {isZh ? `第 ${snapshot.lastChapter.number} 章` : `Chapter ${snapshot.lastChapter.number}`}
              {snapshot.lastChapter.title ? ` · ${snapshot.lastChapter.title}` : ""}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {statusLabel(snapshot.lastChapter.status, isZh)}
            </div>
          </div>
          {snapshot.lastChapter.blocked && (
            <button
              type="button"
              onClick={() => nav.toChapter(bookId, snapshot.lastChapter!.number)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
            >
              <AlertTriangle size={14} />
              {isZh ? "去审稿" : "Open review"}
            </button>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border/40 px-5 py-5 space-y-3" data-testid="cockpit-write-next">
        <button
          type="button"
          onClick={() => void handleWriteNext()}
          disabled={writing || (snapshot ? !snapshot.writeNext.enabled : false)}
          title={snapshot && !snapshot.writeNext.enabled
            ? (isZh ? "落墨被闸：先看原因，再去排纲" : "Write blocked by G1")
            : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50"
          data-testid="cockpit-write-next-button"
        >
          {writing
            ? <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
            : <Zap size={16} />}
          {writing ? t("dash.writing") : (isZh ? "落墨 · 写下一章" : "落墨 · Write next")}
        </button>
        {snapshot && !snapshot.writeNext.enabled && (
          <ul className="space-y-1 text-sm text-destructive" data-testid="cockpit-g1-reasons">
            {snapshot.writeNext.reasons.map((reason) => (
              <li key={reason.code}>
                {isZh ? reason.messageZh : reason.message}
                {reason.jumpTo === "outline" && (
                  <button type="button" className="ml-2 underline" onClick={() => nav.toOutline(bookId)}>
                    {isZh ? "去排纲" : "Open outline"}
                  </button>
                )}
                {reason.jumpTo === "review" && reason.chapterNumber && (
                  <button type="button" className="ml-2 underline" onClick={() => nav.toChapter(bookId, reason.chapterNumber!)}>
                    {isZh ? "去审稿" : "Open review"}
                  </button>
                )}
                {reason.jumpTo === "intent" && (
                  <button type="button" className="ml-2 underline" onClick={() => nav.toTruth(bookId)}>
                    {isZh ? "去意图" : "Open intent"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={skipPreviousApproval}
            onChange={(event) => setSkipPreviousApproval(event.target.checked)}
          />
          {isZh ? "带病续写（上一章未通过也继续）" : "Continue even if previous chapter is unapproved"}
        </label>
      </section>

      <SerialCockpitStrip
        bookId={bookId}
        isZh={isZh}
        skipPreviousApproval={skipPreviousApproval}
        onSkipChange={setSkipPreviousApproval}
        onJumpOutline={() => nav.toOutline(bookId)}
        onJumpReview={(chapterNumber) => {
          if (chapterNumber) nav.toChapter(bookId, chapterNumber);
        }}
        showSkip={false}
      />

      {snapshot && snapshot.pendingProposalCount > 0 && (
        <section className="space-y-2" data-testid="cockpit-proposals">
          <div className="text-sm font-medium">
            {isZh ? `待确认正典 ${snapshot.pendingProposalCount} 条` : `${snapshot.pendingProposalCount} pending canon diffs`}
          </div>
          {snapshot.pendingProposals.map((proposal) => (
            <TruthProposalCard
              key={proposal.id}
              bookId={bookId}
              proposal={proposal}
              isZh={isZh}
              onResolved={refreshAux}
            />
          ))}
        </section>
      )}

      {snapshot?.criticalReview && (
        <button
          type="button"
          data-testid="cockpit-review-shortcut"
          onClick={() => nav.toChapter(bookId, snapshot.criticalReview!.chapterNumber)}
          className="flex w-full items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-left"
        >
          <span className="text-sm font-medium text-destructive">
            {isZh
              ? `审稿队列：第 ${snapshot.criticalReview.chapterNumber} 章有 critical 问题`
              : `Review queue: chapter ${snapshot.criticalReview.chapterNumber} has critical issues`}
          </span>
          <span className="text-xs font-bold text-destructive">{isZh ? "去处理" : "Open"}</span>
        </button>
      )}

      {snapshot?.volumeClose && (
        <section className="rounded-2xl border border-primary/30 bg-primary/[0.05] px-5 py-4 space-y-3" data-testid="cockpit-volume-close">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={16} className="text-primary" />
            {isZh ? "过卷里程碑" : "Volume close"}
          </div>
          <p className="text-sm text-muted-foreground">{snapshot.volumeClose.reason}</p>
          <button
            type="button"
            onClick={() => nav.toBookChat(bookId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-bold"
          >
            <Feather size={14} />
            {isZh ? "织卷 · 起草下一卷" : "织卷 · Draft next volume"}
          </button>
        </section>
      )}

      {(writing || activity.lastError) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          activity.lastError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/[0.04]"
        }`}>
          {activity.lastError ? `${t("book.pipelineFailed")}: ${activity.lastError}` : t("book.pipelineWriting")}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => nav.toOutline(bookId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ListTree size={14} />
          {isZh ? "打开大纲" : "Open outline"}
        </button>
        <button
          type="button"
          onClick={() => nav.toBookChat(bookId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <Feather size={14} />
          {isZh ? "织卷" : "织卷"}
        </button>
      </div>
    </div>
  );
}
