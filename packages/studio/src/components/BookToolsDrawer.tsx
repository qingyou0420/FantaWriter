/**
 * Secondary book tools. Functions stay the same; only the entry moves.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import { Drawer } from "./ui/drawer";

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
    <Drawer open={open} title={t("book.moreTools")} onClose={onClose} testId="book-tools-drawer">
      <div className="space-y-4">
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
      </div>
    </Drawer>
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
      className="w-full rounded-xl border border-border px-4 py-3 text-left hover:bg-accent disabled:opacity-50"
    >
      <div className="text-sm font-medium">{pending ? "…" : label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}
