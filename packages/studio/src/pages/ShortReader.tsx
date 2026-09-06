/**
 * 创作书房 — short-fiction chrome around the existing staged manuscript.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { cjk } from "@streamdown/cjk";
import { AlertCircle, ChevronLeft, Feather, Loader2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LiteraryEmpty } from "../components/LiteraryEmpty";
import { StageDot } from "../components/StageDot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import type { Theme } from "../hooks/use-theme";
import { tr } from "../lib/app-language";
import { deleteStudioShortWork } from "../lib/short-api";
import { deriveShortStudy, shortStudyCtaLabel } from "../lib/short-study";
import { showToast } from "../lib/toast";
import { continueShortPrompt, shortManuscriptExportPath } from "../lib/work-export";
import type { StudioShortDetail } from "../shared/short-works";
import { useChatStore } from "../store/chat";

const streamdownPlugins = { cjk };

interface Nav {
  toDashboard: () => void;
  toChat?: () => void;
  toShortSettings?: (id: string) => void;
  toShortAnalytics?: (id: string) => void;
}

const STEPS = [
  { id: "ask" as const, zh: "问心", en: "Ask" },
  { id: "weave" as const, zh: "织卷", en: "Weave" },
  { id: "write" as const, zh: "落笔", en: "Write" },
];

export function ShortReader({ storyId, nav, theme: _theme, t }: {
  storyId: string;
  nav: Nav;
  theme: Theme;
  t: TFunction;
}) {
  const { data, loading, error } = useApi<StudioShortDetail>(`/shorts/${encodeURIComponent(storyId)}`);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isZh = t("nav.connected") === "已连接";
  const study = data
    ? deriveShortStudy({
      status: data.status,
      contentKind: data.contentKind,
      hasDirection: Boolean(data.direction?.trim()),
    })
    : null;
  const createDraftSession = useChatStore((state) => state.createDraftSession);
  const setInput = useChatStore((state) => state.setInput);
  const activateSession = useChatStore((state) => state.activateSession);

  const continueTalk = () => {
    if (!data) return;
    const sessionId = createDraftSession(null, "short");
    const prompt = continueShortPrompt(data.title, storyId);
    setInput(isZh ? prompt.zh : prompt.en);
    activateSession(sessionId);
    nav.toChat?.();
  };

  const onPrimary = () => {
    if (!study || !data) return;
    if (study.primaryCta === "export") {
      window.location.assign(shortManuscriptExportPath(storyId));
      return;
    }
    continueTalk();
  };

  const handleDelete = async () => {
    try {
      await deleteStudioShortWork(storyId);
      setDeleteOpen(false);
      nav.toDashboard();
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : t("common.error"), "error");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8" data-testid="short-study">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={nav.toDashboard}
          className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          {t("reader.backToList")}
        </button>
        {study && (
          <ol className="flex items-center gap-1" data-testid="short-stage-strip">
            {STEPS.map((step, index) => {
              const state = study.steps[step.id];
              return (
                <li key={step.id} className="flex items-center gap-1 text-[13px]">
                  {index > 0 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
                  <span data-testid={`short-step-${step.id}`} data-state={state} className={`inline-flex items-center gap-1.5 ${state === "current" ? "font-semibold" : "text-muted-foreground"}`}>
                    <StageDot state={state} />
                    {isZh ? step.zh : step.en}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger data-testid="short-more" className="rounded-lg bg-secondary/50 p-2 text-muted-foreground">
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => nav.toShortSettings?.(storyId)}>{t("short.settings")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => nav.toShortAnalytics?.(storyId)}>{t("book.analytics")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.assign(shortManuscriptExportPath(storyId))}>
              {t("book.export")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          {tr("正在打开短篇…", "Opening short…")}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && study && (
        <>
          <header className="space-y-3">
            <div className="literary-kicker">{isZh ? "创作书房" : "Writing study"}</div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h1 className="font-serif text-[40px]">{data.title}</h1>
              {data.coverImagePath ? (
                <img
                  src={data.coverImagePath}
                  alt=""
                  className="h-[213px] w-[160px] rounded-lg border border-border/50 object-cover"
                />
              ) : null}
            </div>
            <button
              type="button"
              data-testid="short-primary-cta"
              onClick={onPrimary}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <Feather size={16} />
              {shortStudyCtaLabel(study.primaryCta, isZh)}
            </button>
          </header>
          {data.content.trim() ? (
            <article className="prose prose-neutral dark:prose-invert max-w-none text-[16px] leading-8 prose-headings:font-semibold prose-h1:text-[26px] prose-h2:text-[22px] prose-h3:text-[19px] prose-p:my-4">
              <Streamdown plugins={streamdownPlugins} mode="static">
                {data.content}
              </Streamdown>
            </article>
          ) : (
            <LiteraryEmpty
              title={isZh ? "还没有可阅读的正文" : "Nothing on the page yet"}
              subtitle={isZh ? "从问心或织卷接着往下。" : "Continue from Ask or Weave."}
              action={shortStudyCtaLabel(study.primaryCta === "export" ? "write" : study.primaryCta, isZh)}
              onAction={onPrimary}
              testId="short-empty"
            />
          )}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4" data-testid="short-danger-zone">
            <div className="text-[13px] text-destructive">{isZh ? "危险区" : "Danger zone"}</div>
            <button
              type="button"
              data-testid="short-delete"
              onClick={() => setDeleteOpen(true)}
              className="mt-2 rounded-xl bg-destructive px-4 py-2 text-sm text-primary-foreground"
            >
              {isZh ? "删除短篇" : "Delete short"}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={isZh ? "删除这篇短篇？" : "Delete this short?"}
        message={isZh ? "删除后无法恢复。" : "This cannot be undone."}
        confirmLabel={isZh ? "删除" : "Delete"}
        cancelLabel={t("common.cancel")}
        variant="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
