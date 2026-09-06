import { useMemo } from "react";
import { useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import type { SSEMessage } from "../hooks/use-sse";
import { deriveActiveBookIds } from "../hooks/use-book-activity";
import { deriveActivityHeadline, formatActivityEvent } from "../lib/activity-copy";

interface LogEntry {
  readonly level?: string;
  readonly tag?: string;
  readonly message: string;
  readonly timestamp?: string;
}

interface Nav {
  toDashboard: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "text-destructive",
  warn: "text-mark-text",
  info: "text-primary/70",
  debug: "text-muted-foreground/50",
};

export function LogViewer({ nav, theme, t, sse }: {
  nav: Nav;
  theme: Theme;
  t: TFunction;
  sse?: { messages: ReadonlyArray<SSEMessage> };
}) {
  const c = useColors(theme);
  const isZh = t("nav.connected") === "已连接";
  const { data, refetch } = useApi<{ entries: ReadonlyArray<LogEntry> }>("/logs");
  const { data: booksData } = useApi<{ books: ReadonlyArray<{ id: string; title: string }> }>("/books");
  const books = booksData?.books ?? [];
  const messages = sse?.messages ?? [];
  const activityBooks = useMemo(() => deriveActiveBookIds(messages), [messages]);
  const headline = useMemo(
    () => (activityBooks.size > 0 ? deriveActivityHeadline(messages, books, isZh) : t("logs.idle")),
    [activityBooks.size, books, isZh, messages, t],
  );
  const liveLines = useMemo(
    () => messages
      .map((msg) => formatActivityEvent(msg, books, isZh))
      .filter((line): line is NonNullable<typeof line> => line !== null)
      .slice(-40)
      .reverse(),
    [books, isZh, messages],
  );

  return (
    <div className="space-y-6" data-testid="ai-activity-page">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={nav.toDashboard} className={c.link}>{t("bread.home")}</button>
        <span className="text-border">/</span>
        <span className="text-foreground">{t("logs.title")}</span>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl">{t("logs.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {headline}
          </span>
          <button
            onClick={() => refetch()}
            className={`px-4 py-2.5 text-sm rounded-md ${c.btnSecondary}`}
          >
            {t("common.refresh")}
          </button>
        </div>
      </div>

      <div className={`border ${c.cardStatic} rounded-lg overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-border">
          <span className="text-sm text-muted-foreground font-medium">{t("logs.live")}</span>
        </div>
        <div className="p-4 max-h-[360px] overflow-y-auto">
          {liveLines.length > 0 ? (
            <div className="space-y-2 text-sm leading-6">
              {liveLines.map((line, i) => (
                <div key={`${line.time}-${line.text}-${i}`} className="flex gap-3">
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{line.time}</span>
                  {line.bookTitle && (
                    <span className="shrink-0 text-foreground/80">《{line.bookTitle}》</span>
                  )}
                  <span className="text-foreground/80">{line.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic py-10 text-center">
              {t("logs.noActivity")}
            </div>
          )}
        </div>
      </div>

      <div className={`border ${c.cardStatic} rounded-lg overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-border">
          <span className="text-sm text-muted-foreground font-medium">{t("logs.raw")}</span>
        </div>
        <div className="p-4 max-h-[360px] overflow-y-auto">
          {data?.entries && data.entries.length > 0 ? (
            <div className="space-y-1 font-mono text-sm leading-relaxed">
              {data.entries.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  {entry.timestamp && (
                    <span className="text-muted-foreground shrink-0 w-20 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                  {entry.level && (
                    <span className={`shrink-0 w-12 ${LEVEL_COLORS[entry.level] ?? "text-muted-foreground"}`}>
                      {entry.level}
                    </span>
                  )}
                  {entry.tag && (
                    <span className="text-primary/70 shrink-0">[{entry.tag}]</span>
                  )}
                  <span className="text-foreground/80">{entry.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic py-12 text-center">
              {t("logs.empty")}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
