/**
 * 连载书房: today's stroke, volume arrive, attention list, four-step overview.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fetchJson, useApi } from "../hooks/use-api";
import { useEffect, useMemo, useState } from "react";
import { BookWorkspaceNav, type BookWorkspaceNavTarget } from "../components/BookWorkspaceNav";
import { startWriteNext } from "../components/SerialCockpitStrip";
import type { WritePreflightEvaluation } from "../components/SerialCockpitStrip";
import { TruthProposalCard, type PendingTruthProposal } from "../components/TruthProposalCard";
import { assembleCockpitSnapshot, type CockpitDueHook, type CockpitReviewItem } from "../lib/serial-cockpit";
import { deriveBookActivity, shouldRefetchBookView } from "../hooks/use-book-activity";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import type { BookStageSnapshot } from "../lib/book-stage";
import {
  formatVolumeArriveCopy,
  hasPreviousChapterUnapprovedReason,
  shortChapterTitle,
  stripEngineTokens,
} from "../lib/copy-map";
import { formatStartedOn, studyGuideCopy } from "../lib/stage-copy";
import { lockedNamedVolumeCount } from "../lib/volume-map-tree";
import {
  AlertTriangle,
  CheckCircle2,
  Feather,
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
    readonly createdAt?: string;
    readonly targetChapters?: number;
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
    "audit-failed": ["须处理", "must fix"],
    drafted: ["草稿", "drafted"],
    "needs-revision": ["需修订", "needs revision"],
    imported: ["已导入", "imported"],
    "state-degraded": ["状态降级", "state degraded"],
  };
  const pair = map[status];
  return pair ? (isZh ? pair[0] : pair[1]) : status;
}

function goStage(
  nav: Nav,
  bookId: string,
  target: "ask" | "ground" | "weave" | "write",
): void {
  if (target === "ask") nav.toAsk(bookId);
  else if (target === "ground") (nav.toGround ?? nav.toTruth ?? nav.toBook)(bookId);
  else if (target === "weave") (nav.toWeave ?? nav.toOutline)(bookId);
  else (nav.toWrite ?? nav.toBookSettings)(bookId);
}

export function BookStudy({
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
  const [stage, setStage] = useState<BookStageSnapshot | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [volumeExpanded, setVolumeExpanded] = useState(false);

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
    void fetchJson<BookStageSnapshot>(`/books/${bookId}/stage`)
      .then(setStage)
      .catch(() => setStage(null));
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
      goStage(nav, bookId, "weave");
      return;
    }
    setWritePending(true);
    setPageError(null);
    try {
      await startWriteNext(bookId, skipPreviousApproval);
    } catch (err) {
      setWritePending(false);
      setPageError(err instanceof Error ? err.message : "Failed");
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
  const totalWords = data.chapters.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);
  const target = book.targetChapters && book.targetChapters > 0 ? book.targetChapters : 0;
  const currentStage = stage?.stage ?? "write";
  const guide = studyGuideCopy(currentStage, isZh);
  const canWrite = currentStage === "write";
  const showSkip = hasPreviousChapterUnapprovedReason(snapshot?.writeNext.reasons ?? preflight?.reasons ?? []);
  const volumeCopy = snapshot?.volume?.okr
    ? formatVolumeArriveCopy(snapshot.volume.okr, isZh)
    : { arrive: "", mustLand: "" };
  const attentionItems: Array<{ key: string; label: string; onClick?: () => void }> = [];
  if (snapshot?.lastChapter?.blocked) {
    attentionItems.push({
      key: `review-${snapshot.lastChapter.number}`,
      label: isZh
        ? `第 ${snapshot.lastChapter.number} 章 ${statusLabel(snapshot.lastChapter.status, true)}`
        : `Chapter ${snapshot.lastChapter.number} ${statusLabel(snapshot.lastChapter.status, false)}`,
      onClick: () => nav.toChapter(bookId, snapshot.lastChapter!.number),
    });
  }
  if (snapshot && snapshot.pendingProposalCount > 0) {
    attentionItems.push({
      key: "canon",
      label: isZh ? `正典变更 ${snapshot.pendingProposalCount} 处` : `${snapshot.pendingProposalCount} canon changes`,
    });
  }
  for (const hook of snapshot?.overdueHooks ?? []) {
    attentionItems.push({
      key: `hook-${hook.hookId}`,
      label: isZh
        ? `伏笔「${stripEngineTokens(hook.hookId)}」${hook.targetChapter ? `目标第 ${hook.targetChapter} 章` : ""}，已逾期`
        : `Hook ${stripEngineTokens(hook.hookId)} overdue`,
      onClick: () => goStage(nav, bookId, "weave"),
    });
  }
  const nextTitle = snapshot?.nextChapter.title
    ? shortChapterTitle(snapshot.nextChapter.title)
    : "";
  const lockedVolumes = snapshot ? lockedNamedVolumeCount(snapshot.tree) : 0;
  const volumeTotal = snapshot?.tree.volumeCount ?? 0;
  const planned = snapshot?.tree.chapterCount ?? 0;

  return (
    <div className="space-y-8 fade-in" data-testid="serial-cockpit-home">
      <BookWorkspaceNav bookId={bookId} active="study" nav={nav} isZh={isZh} t={t} />

      <header className="space-y-2">
        <h1 className="font-serif text-4xl font-medium">{book.title}</h1>
        <p className="text-sm text-muted-foreground">
          {[
            book.genre,
            formatStartedOn(book.createdAt, isZh),
            isZh
              ? `已写 ${data.chapters.length}${target ? ` / ${target}` : ""} 章`
              : `${data.chapters.length}${target ? ` / ${target}` : ""} chapters`,
            isZh ? `${totalWords.toLocaleString()} 字` : `${totalWords.toLocaleString()} words`,
          ].filter(Boolean).join(" · ")}
        </p>
      </header>

      {snapshot?.volumeClose ? (
        <section className="rounded-2xl border border-primary/30 bg-primary/[0.05] px-5 py-5 space-y-3" data-testid="cockpit-volume-close">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={16} className="text-primary" />
            {isZh ? "本卷已收" : "Volume closed"}
          </div>
          <p className="text-sm text-muted-foreground">{stripEngineTokens(snapshot.volumeClose.reason)}</p>
          <button
            type="button"
            onClick={() => goStage(nav, bookId, "weave")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Feather size={14} />
            {isZh ? "去织卷起草下一卷" : "Weave the next volume"}
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-5 space-y-3" data-testid="cockpit-next-chapter">
          <div className="text-[13px] text-muted-foreground">{canWrite ? t("study.today") : guide.title}</div>
          {canWrite && snapshot ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="font-serif text-3xl">
                  {isZh ? `第 ${snapshot.nextChapter.number} 章` : `Chapter ${snapshot.nextChapter.number}`}
                  {nextTitle ? ` · ${nextTitle}` : ""}
                </div>
                {snapshot.nextChapter.volumePosition && (
                  <div className="text-sm text-muted-foreground">{snapshot.nextChapter.volumePosition}</div>
                )}
              </div>
              {snapshot.nextChapter.oneLine && (
                <p className="text-sm leading-6 text-foreground/80">{snapshot.nextChapter.oneLine}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{guide.subtitle}</p>
          )}

          {canWrite && snapshot?.writeNext.enabled ? (
            <button
              type="button"
              onClick={() => void handleWriteNext()}
              disabled={writing}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              data-testid="cockpit-write-next-button"
            >
              {writing
                ? <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                : <Feather size={16} />}
              {writing ? t("dash.writing") : (isZh ? "落墨 · 写下一章" : "落墨 · Write next")}
            </button>
          ) : canWrite && snapshot && !snapshot.writeNext.enabled ? (
            <div className="space-y-2" data-testid="cockpit-write-next">
              <ul className="space-y-1 text-sm text-destructive" data-testid="cockpit-g1-reasons">
                {snapshot.writeNext.reasons.map((reason) => (
                  <li key={reason.code}>
                    {isZh ? reason.messageZh : reason.message}
                    {reason.jumpTo === "outline" && (
                      <button type="button" className="ml-2 underline" onClick={() => goStage(nav, bookId, "weave")}>
                        {isZh ? "去织卷" : "Open weave"}
                      </button>
                    )}
                    {reason.jumpTo === "review" && reason.chapterNumber && (
                      <button type="button" className="ml-2 underline" onClick={() => nav.toChapter(bookId, reason.chapterNumber!)}>
                        {isZh ? "去审稿" : "Open review"}
                      </button>
                    )}
                    {reason.jumpTo === "intent" && (
                      <button type="button" className="ml-2 underline" onClick={() => goStage(nav, bookId, "ground")}>
                        {isZh ? "去研墨" : "Open ground"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {showSkip && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={skipPreviousApproval}
                    onChange={(event) => setSkipPreviousApproval(event.target.checked)}
                  />
                  {t("book.skipUnapproved")}
                </label>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => goStage(nav, bookId, guide.target === "create" ? "ask" : guide.target)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
              data-testid="study-stage-guide"
            >
              {guide.action}
            </button>
          )}
        </section>
      )}

      {snapshot?.volume && (
        <section className="space-y-2" data-testid="cockpit-volume-okr">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">
              {isZh ? "本卷要抵达" : "This volume should arrive at"}
              {" — "}
              {snapshot.volume.name}
            </div>
            <div className="text-xs text-muted-foreground">{snapshot.volume.progressLabel}</div>
          </div>
          {(volumeCopy.arrive || snapshot.volume.okr) && (
            <button
              type="button"
              onClick={() => setVolumeExpanded((open) => !open)}
              className="block w-full text-left text-sm leading-6 text-muted-foreground"
            >
              {volumeExpanded
                ? (
                  <span className="whitespace-pre-wrap">
                    {volumeCopy.arrive || stripEngineTokens(snapshot.volume.okr ?? "")}
                    {volumeCopy.mustLand ? `\n${isZh ? "卷末必须落下：" : "Must land: "}${volumeCopy.mustLand}` : ""}
                  </span>
                )
                : (
                  <span className="line-clamp-1">
                    {volumeCopy.arrive || stripEngineTokens(snapshot.volume.okr ?? "")}
                  </span>
                )}
            </button>
          )}
        </section>
      )}

      {attentionItems.length > 0 && (
        <section className="space-y-2" data-testid="cockpit-attention">
          <div className="text-sm font-medium">{isZh ? "等你过目" : "Waiting for you"}</div>
          <ul className="space-y-1 text-sm">
            {attentionItems.map((item) => (
              <li key={item.key}>
                {item.onClick ? (
                  <button type="button" className="underline-offset-2 hover:underline" onClick={item.onClick}>
                    {item.label}
                    {isZh ? " → 去看" : " → Open"}
                  </button>
                ) : item.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot && snapshot.pendingProposalCount > 0 && (
        <section className="space-y-2" data-testid="cockpit-proposals">
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
          <span className="inline-flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle size={14} />
            {isZh
              ? `第 ${snapshot.criticalReview.chapterNumber} 章有须处理的问题`
              : `Chapter ${snapshot.criticalReview.chapterNumber} has must-fix issues`}
          </span>
          <span className="text-xs font-bold text-destructive">{isZh ? "去审稿" : "Open"}</span>
        </button>
      )}

      <section className="space-y-3 border-t border-border/40 pt-6" data-testid="study-four-steps">
        <div className="text-sm font-medium">{isZh ? "四步一览" : "Four steps"}</div>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            {isZh ? "问心" : "Ask"} {stage?.steps.ask === "done" ? "✓" : "○"}
            <span className="ml-2 text-muted-foreground">{book.genre}</span>
          </div>
          <div>
            {isZh ? "研墨" : "Ground"} {stage?.steps.ground === "done" ? "✓" : stage?.stage === "ground" ? "●" : "○"}
          </div>
          <div>
            {isZh ? "织卷" : "Weave"} {stage?.steps.weave === "done" ? "✓" : stage?.stage === "weave" ? "●" : "○"}
            <span className="ml-2 text-muted-foreground">
              {isZh
                ? `已锁 ${lockedVolumes} 卷 · 细纲 ${planned}${target ? `/${target}` : ""}`
                : `${lockedVolumes}/${volumeTotal} vol · ${planned}${target ? `/${target}` : ""} outlined`}
            </span>
          </div>
          <div>
            {isZh ? "落笔" : "Write"} {stage?.steps.write === "done" ? "✓" : canWrite ? "●" : "○"}
            <span className="ml-2 text-muted-foreground">
              {isZh ? `${data.chapters.length} 章` : `${data.chapters.length} chapters`}
            </span>
          </div>
        </div>
      </section>

      {(writing || activity.lastError || pageError) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          activity.lastError || pageError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/[0.04]"
        }`}>
          {pageError
            ?? (activity.lastError ? `${t("book.pipelineFailed")}: ${activity.lastError}` : t("book.pipelineWriting"))}
        </div>
      )}
    </div>
  );
}

export { BookStudy as SerialCockpit };
