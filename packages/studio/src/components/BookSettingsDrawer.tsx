/**
 * Book settings + danger zone. Opened from ⋯, never from the write header.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";

type BookStatus = "active" | "paused" | "completed" | "dropped";

export function BookSettingsDrawer({
  bookId,
  open,
  onClose,
  t,
  isZh,
  onDeleted,
}: {
  readonly bookId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly t: TFunction;
  readonly isZh: boolean;
  readonly onDeleted: () => void;
}) {
  const [wordCount, setWordCount] = useState(3000);
  const [targetChapters, setTargetChapters] = useState(200);
  const [status, setStatus] = useState<BookStatus>("active");
  const [title, setTitle] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmName("");
    setError(null);
    void fetchJson<{
      book: { title: string; chapterWordCount: number; targetChapters?: number; status: string };
    }>(`/books/${bookId}`).then((body) => {
      setTitle(body.book.title);
      setWordCount(body.book.chapterWordCount);
      setTargetChapters(body.book.targetChapters ?? 200);
      const next = body.book.status;
      setStatus(next === "paused" || next === "completed" || next === "dropped" ? next : "active");
    }).catch(() => undefined);
  }, [bookId, open]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/books/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterWordCount: wordCount, targetChapters, status }),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (confirmName.trim() !== title) return;
    setDeleting(true);
    setError(null);
    try {
      await fetchJson(`/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" onClick={onClose} data-testid="book-settings-drawer">
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card px-5 py-6 space-y-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t("book.settings")}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            {isZh ? "关闭" : "Close"}
          </button>
        </div>
        <label className="block space-y-1 text-sm">
          <span>{t("create.wordsPerChapter")}</span>
          <input type="number" value={wordCount} onChange={(event) => setWordCount(Number(event.target.value))} className="w-full rounded-lg border border-border/50 bg-secondary/30 px-3 py-2" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("create.targetChapters")}</span>
          <input type="number" value={targetChapters} onChange={(event) => setTargetChapters(Number(event.target.value))} className="w-full rounded-lg border border-border/50 bg-secondary/30 px-3 py-2" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("book.status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as BookStatus)} className="w-full rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
            <option value="active">{t("book.statusActive")}</option>
            <option value="paused">{t("book.statusPaused")}</option>
            <option value="completed">{t("book.statusCompleted")}</option>
            <option value="dropped">{t("book.statusDropped")}</option>
          </select>
        </label>
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving ? t("book.saving") : t("book.save")}
        </button>
        <div className="border-t border-destructive/30 pt-4 space-y-3" data-testid="book-danger-zone">
          <div className="text-sm font-medium text-destructive">{t("book.dangerZone")}</div>
          <p className="text-xs text-muted-foreground">{t("book.typeTitleToDelete")}（{title}）</p>
          <input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            data-testid="book-delete-confirm-name"
            className="w-full rounded-lg border border-destructive/30 bg-secondary/20 px-3 py-2 text-sm"
          />
          <button
            type="button"
            data-testid="book-delete-confirm"
            disabled={deleting || confirmName.trim() !== title}
            onClick={() => void remove()}
            className="rounded-lg bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive disabled:opacity-40"
          >
            {deleting ? t("common.loading") : t("book.deleteBook")}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </aside>
    </div>
  );
}
