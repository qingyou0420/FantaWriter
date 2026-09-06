/**
 * Secondary book tools. Functions stay the same; only the entry moves.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";

export function BookToolsDrawer({
  bookId,
  open,
  onClose,
  t,
  isZh,
  onOpenAnalytics,
}: {
  readonly bookId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly t: TFunction;
  readonly isZh: boolean;
  readonly onOpenAnalytics: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) return null;

  const run = async (key: string, action: () => Promise<string>) => {
    setPending(key);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" onClick={onClose} data-testid="book-tools-drawer">
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card px-5 py-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("book.moreTools")}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            {isZh ? "关闭" : "Close"}
          </button>
        </div>
        <ToolRow
          label={t("book.analytics")}
          hint={isZh ? "看字数、通过率和伏笔回收。" : "Words, pass rate, and hook resolve."}
          onClick={() => { onOpenAnalytics(); onClose(); }}
        />
        <ToolRow
          label={t("book.evaluate")}
          hint={isZh ? "对已写章节做一次质量评估。" : "Score the chapters already written."}
          pending={pending === "eval"}
          onClick={() => void run("eval", async () => {
            const result = await fetchJson<{ qualityScore: number }>(`/books/${bookId}/eval`);
            return `${t("book.evaluate")}: ${result.qualityScore}/100`;
          })}
        />
        <ToolRow
          label={t("book.consolidate")}
          hint={isZh ? "把旧卷摘要归并，腾出上下文。" : "Archive old volume summaries."}
          pending={pending === "consolidate"}
          onClick={() => void run("consolidate", async () => {
            const result = await fetchJson<{ archivedVolumes?: number }>(`/books/${bookId}/consolidate`, { method: "POST" });
            return isZh ? `已归并 ${result.archivedVolumes ?? 0} 个卷摘要` : `Archived ${result.archivedVolumes ?? 0} volume(s)`;
          })}
        />
        <ToolRow
          label={t("book.composeNext")}
          hint={isZh ? "按下一章契约组装一稿，不改硬闸。" : "Assemble the next chapter from the existing contract."}
          pending={pending === "compose"}
          onClick={() => void run("compose", async () => {
            const result = await fetchJson<{ chapterNumber?: number; title?: string }>(`/books/${bookId}/compose`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            return isZh
              ? `已组装第 ${result.chapterNumber ?? "?"} 章`
              : `Composed chapter ${result.chapterNumber ?? "?"}`;
          })}
        />
        {message && <p className="whitespace-pre-wrap text-sm text-muted-foreground" data-testid="book-tools-message">{message}</p>}
      </aside>
    </div>
  );
}

function ToolRow({
  label,
  hint,
  pending,
  onClick,
}: {
  readonly label: string;
  readonly hint: string;
  readonly pending?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="w-full rounded-xl border border-border/50 px-4 py-3 text-left hover:bg-secondary/40 disabled:opacity-50"
    >
      <div className="text-sm font-medium">{pending ? "…" : label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}
