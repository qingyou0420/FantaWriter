import { cjk } from "@streamdown/cjk";
import { AlertCircle, ChevronLeft, Loader2, ScrollText } from "lucide-react";
import { Streamdown } from "streamdown";
import { useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import type { Theme } from "../hooks/use-theme";
import { tr } from "../lib/app-language";
import type { StudioShortDetail } from "../shared/short-works";

const streamdownPlugins = { cjk };

interface Nav {
  toDashboard: () => void;
}

function statusLabel(status: StudioShortDetail["status"], t: TFunction): string {
  if (status === "completed") return t("book.statusCompleted");
  if (status === "outlining") return t("book.statusOutlining");
  if (status === "failed") return t("book.statusDropped");
  return t("short.statusDrafting");
}

export function ShortReader({ storyId, nav, theme: _theme, t }: {
  storyId: string;
  nav: Nav;
  theme: Theme;
  t: TFunction;
}) {
  const { data, loading, error } = useApi<StudioShortDetail>(`/shorts/${encodeURIComponent(storyId)}`);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <button
        type="button"
        onClick={nav.toDashboard}
        className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        {t("reader.backToList")}
      </button>

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

      {data && (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[12px] font-semibold text-primary">
                <ScrollText size={12} />
                {t("short.badge")}
              </span>
              <span className="rounded-full bg-secondary/70 px-2.5 py-0.5 text-[12px] text-muted-foreground">
                {statusLabel(data.status, t)}
              </span>
              {data.chapterCount ? (
                <span className="text-[12px] text-muted-foreground">
                  {data.chapterCount} {t("dash.chapters")}
                </span>
              ) : null}
            </div>
            <h1 className="font-serif text-4xl">{data.title}</h1>
            <p className="text-[13px] text-muted-foreground">
              {data.contentKind === "outline"
                ? tr("当前可打开的是已锁定大纲。", "Showing the locked outline.")
                : data.contentKind === "draft"
                  ? tr("当前可打开的是进行中的草稿。", "Showing the in-progress draft.")
                  : tr("终稿", "Final manuscript")}
            </p>
          </header>
          {data.content.trim() ? (
            <article className="prose prose-neutral dark:prose-invert max-w-none text-[16px] leading-8 prose-headings:font-semibold prose-h1:text-[26px] prose-h2:text-[22px] prose-h3:text-[19px] prose-p:my-4">
              <Streamdown plugins={streamdownPlugins} mode="static">
                {data.content}
              </Streamdown>
            </article>
          ) : (
            <div className="rounded-xl border border-dashed border-border/55 px-4 py-10 text-center text-sm text-muted-foreground">
              {tr("还没有可阅读的正文。", "No readable manuscript yet.")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
