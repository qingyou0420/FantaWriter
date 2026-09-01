import { fetchJson, postApi } from "../hooks/use-api";
import { useEffect, useState } from "react";

export interface WritePreflightReason {
  readonly code: string;
  readonly message: string;
  readonly messageZh: string;
  readonly jumpTo?: "outline" | "intent" | "review";
  readonly chapterNumber?: number;
}

export interface WritePreflightEvaluation {
  readonly ok: boolean;
  readonly chapterNumber: number;
  readonly reasons: ReadonlyArray<WritePreflightReason>;
  readonly message: string;
}

export interface DueHook {
  readonly hookId: string;
  readonly dueState?: string;
  readonly targetChapter?: number;
  readonly status?: string;
}

export function SerialCockpitStrip({
  bookId,
  isZh,
  onJumpOutline,
  onJumpReview,
  skipPreviousApproval,
  onSkipChange,
  showSkip = true,
}: {
  readonly bookId: string;
  readonly isZh: boolean;
  readonly onJumpOutline?: () => void;
  readonly onJumpReview?: (chapterNumber?: number) => void;
  readonly skipPreviousApproval: boolean;
  readonly onSkipChange: (next: boolean) => void;
  readonly showSkip?: boolean;
}) {
  const [preflight, setPreflight] = useState<WritePreflightEvaluation | null>(null);
  const [hooks, setHooks] = useState<ReadonlyArray<DueHook>>([]);

  useEffect(() => {
    const query = skipPreviousApproval ? "?skipPreviousApproval=1" : "";
    void fetchJson<WritePreflightEvaluation>(`/books/${bookId}/write-preflight${query}`)
      .then(setPreflight)
      .catch(() => setPreflight(null));
    void fetchJson<{ hooks?: DueHook[] }>(`/books/${bookId}/hooks/due`)
      .then((body) => setHooks(body.hooks ?? []))
      .catch(() => setHooks([]));
  }, [bookId, skipPreviousApproval]);

  const blocked = preflight !== null && !preflight.ok;

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3 space-y-2" data-testid="serial-cockpit">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {isZh ? "下一章" : "Next chapter"} {preflight?.chapterNumber ?? "—"}
          {blocked
            ? (isZh ? " · 落墨未就绪" : " · write blocked")
            : (isZh ? " · 可以落墨" : " · ready to write")}
        </div>
        {showSkip && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={skipPreviousApproval}
            onChange={(event) => onSkipChange(event.target.checked)}
          />
          {isZh ? "带病续写（上一章未通过也继续）" : "Continue even if previous chapter is unapproved"}
        </label>
        )}
      </div>
      {hooks.length > 0 && (
        <div className="text-xs text-amber-600">
          {isZh ? "到期/逾期伏笔：" : "Due/overdue hooks: "}
          {hooks.map((hook) => `${hook.hookId}${hook.dueState === "overdue" ? (isZh ? "（逾期）" : " (overdue)") : ""}`).join(" · ")}
        </div>
      )}
      {blocked && (
        <ul className="space-y-1 text-sm text-destructive">
          {preflight.reasons.map((reason) => (
            <li key={reason.code}>
              {isZh ? reason.messageZh : reason.message}
              {reason.jumpTo === "outline" && onJumpOutline && (
                <button type="button" className="ml-2 underline" onClick={onJumpOutline}>
                  {isZh ? "去排纲" : "Open outline"}
                </button>
              )}
              {reason.jumpTo === "review" && onJumpReview && (
                <button type="button" className="ml-2 underline" onClick={() => onJumpReview(reason.chapterNumber)}>
                  {isZh ? "去审稿" : "Open review"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function startWriteNext(bookId: string, skipPreviousApproval: boolean): Promise<void> {
  await postApi(`/books/${bookId}/write-next`, { skipPreviousApproval });
}

export async function startDraft(bookId: string, skipPreviousApproval: boolean): Promise<void> {
  await postApi(`/books/${bookId}/draft`, { skipPreviousApproval });
}
