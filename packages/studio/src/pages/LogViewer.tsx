import { useMemo, useState } from "react";
import { useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import { useI18n, type TFunction } from "../hooks/use-i18n";
import type { SSEMessage } from "../hooks/use-sse";
import { deriveActiveBookIds } from "../hooks/use-book-activity";
import { LiteraryEmpty } from "../components/LiteraryEmpty";
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
  info: "text-muted-foreground",
  debug: "text-muted-foreground/50",
};

export function LogViewer({ nav: _nav, theme: _theme, t, sse }: {
  nav: Nav;
  theme: Theme;
  t: TFunction;
  sse?: { messages: ReadonlyArray<SSEMessage> };
}) {
  const { lang } = useI18n();
  const isZh = lang !== "en";
  const [rawOpen, setRawOpen] = useState(false);
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
    <div className="space-y-10" data-testid="ai-activity-page">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-[32px] font-medium leading-10">{t("logs.title")}</h1>
        <span className="text-[13px] leading-5 text-muted-foreground">
          {headline}
        </span>
      </div>

      <div>
        <div className="mb-3 text-[13px] font-medium text-muted-foreground">{t("logs.live")}</div>
        {liveLines.length > 0 ? (
          <div className="space-y-2 text-[15px] leading-[26px]">
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
          <LiteraryEmpty
            title={t("logs.noActivity")}
            testId="logs-empty-live"
          />
        )}
      </div>

      <div>
        <button
          type="button"
          data-testid="logs-raw-toggle"
          onClick={() => setRawOpen((open) => !open)}
          className="btn-ghost h-8 px-1 text-[13px] text-muted-foreground"
        >
          {t("logs.rawFold")} {rawOpen ? "▾" : "▸"}
        </button>
        {rawOpen && (
          <div className="mt-3 space-y-3" data-testid="logs-raw-panel">
            <button
              type="button"
              onClick={() => refetch()}
              className="btn-secondary h-8 px-3 text-[13px]"
            >
              {t("common.refresh")}
            </button>
            {data?.entries && data.entries.length > 0 ? (
              <div className="space-y-1 font-mono text-[13px] leading-relaxed">
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
                      <span className="text-muted-foreground shrink-0">[{entry.tag}]</span>
                    )}
                    <span className="text-foreground/80">{entry.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <LiteraryEmpty
                title={t("logs.empty")}
                action={t("common.refresh")}
                onAction={() => refetch()}
                testId="logs-empty-raw"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
