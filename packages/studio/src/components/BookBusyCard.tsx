import { useEffect, useState } from "react";
import { BOOK_BUSY_EVENT, postApi, type StudioApiError } from "../hooks/use-api";

function formatHeld(heldMs?: number): string {
  if (!heldMs || heldMs < 0) return "未知";
  const seconds = Math.max(1, Math.round(heldMs / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.round(seconds / 60)} 分钟`;
}

export function BookBusyCard() {
  const [error, setError] = useState<StudioApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const onBusy = (event: Event) => {
      const detail = (event as CustomEvent<StudioApiError>).detail;
      setError(detail);
      setNote(null);
    };
    window.addEventListener(BOOK_BUSY_EVENT, onBusy);
    return () => window.removeEventListener(BOOK_BUSY_EVENT, onBusy);
  }, []);

  if (!error) return null;
  const owner = error.owner;
  const bookId = owner?.bookId;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold">本书正在被写入</h2>
          <p className="mt-2 text-sm text-muted-foreground break-words">{error.message}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">书</dt>
          <dd>{bookId ?? "未知"}</dd>
          <dt className="text-muted-foreground">任务</dt>
          <dd>{owner?.taskId ?? "未知"}</dd>
          <dt className="text-muted-foreground">阶段</dt>
          <dd>{owner?.stage ?? "未知"}</dd>
          <dt className="text-muted-foreground">已持续</dt>
          <dd>{formatHeld(owner?.heldMs)}</dd>
          <dt className="text-muted-foreground">pid</dt>
          <dd>{owner?.pid ?? "未知"}</dd>
        </dl>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm"
            onClick={() => setError(null)}
          >
            关闭
          </button>
          <button
            type="button"
            disabled={!bookId || busy}
            className="rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
            onClick={async () => {
              if (!bookId) return;
              setBusy(true);
              try {
                await postApi(`/books/${bookId}/lock/force-release`);
                setNote("已强制释放书锁。可以重试刚才的操作。");
                setError(null);
              } catch (err) {
                setNote(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "释放中…" : "强制释放"}
          </button>
        </div>
      </div>
    </div>
  );
}
