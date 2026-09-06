/**
 * Author profile: name, bio, avatar. Persists to `.inkos/author.json`.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useRef, useState } from "react";
import { fetchJson, useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import { AUTHOR_BIO_MAX, AUTHOR_NAME_MAX, type AuthorPublic } from "../lib/author-profile";
import { isInProgressBookStatus } from "../lib/stage-copy";

interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

export function AuthorPage({
  nav,
  t,
  isZh,
}: {
  readonly nav: { toDashboard: () => void };
  readonly t: TFunction;
  readonly isZh: boolean;
}) {
  const { data, mutate } = useApi<AuthorPublic>("/author");
  const { data: booksData } = useApi<{ books: ReadonlyArray<BookSummary> }>("/books");
  const [name, setName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentName = name ?? data?.name ?? "";
  const currentBio = bio ?? data?.bio ?? "";
  const books = booksData?.books ?? [];
  const inProgress = books.filter((book) => isInProgressBookStatus(book.status)).length;
  const paused = books.filter((book) => book.status === "paused").length;
  const completed = books.filter((book) => book.status === "completed").length;
  const avatarSrc = data?.hasAvatar && data.updatedAt
    ? `/api/v1/author/avatar?v=${encodeURIComponent(data.updatedAt)}`
    : data?.hasAvatar
      ? "/api/v1/author/avatar"
      : "";

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await fetchJson<AuthorPublic>("/author", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentName, bio: currentBio }),
      });
      mutate(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError(isZh ? "头像不能超过 2 MB" : "Avatar must be 2 MB or smaller");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    try {
      const next = await fetchJson<AuthorPublic>("/author/avatar", { method: "POST", body });
      mutate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const removeAvatar = async () => {
    setError(null);
    try {
      const next = await fetchJson<AuthorPublic>("/author/avatar", { method: "DELETE" });
      mutate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  };

  return (
    <div className="space-y-8 fade-in" data-testid="author-page">
      <nav className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <button type="button" onClick={nav.toDashboard} className="hover:text-primary">{t("bread.books")}</button>
        <span>/</span>
        <span className="text-foreground">{t("bread.author")}</span>
      </nav>

      <div className="flex items-end gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[oklch(0.36_0.07_160)] text-2xl text-[oklch(0.70_0.09_82)]">
          {avatarSrc
            ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            : (currentName.trim().slice(0, 1) || "墨")}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-secondary px-3 py-2 text-sm">
            {t("author.changeAvatar")}
          </button>
          {data?.hasAvatar && (
            <button type="button" onClick={() => void removeAvatar()} className="rounded-lg px-3 py-2 text-sm text-muted-foreground">
              {t("author.removeAvatar")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-sm">{t("author.name")} ≤{AUTHOR_NAME_MAX}</span>
        <input
          value={currentName}
          maxLength={AUTHOR_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          className="w-full max-w-md rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">{t("author.bio")} ≤{AUTHOR_BIO_MAX}</span>
        <textarea
          value={currentBio}
          maxLength={AUTHOR_BIO_MAX}
          rows={5}
          onChange={(event) => setBio(event.target.value)}
          className="w-full max-w-xl rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 leading-6"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="author-save"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? t("book.saving") : t("author.save")}
        </button>
        {saved && <span className="text-sm text-muted-foreground">{t("author.saved")}</span>}
      </div>
      {error && <p className="text-sm text-destructive" data-testid="author-error">{error}</p>}

      <div className="border-t border-border/40 pt-6 space-y-2">
        <div className="font-medium">{t("author.myBooks")}（{books.length}）</div>
        <button type="button" onClick={nav.toDashboard} className="text-sm text-muted-foreground hover:text-foreground">
          {isZh ? `在创 ${inProgress} · 暂停 ${paused} · 完结 ${completed}` : `${inProgress} active · ${paused} paused · ${completed} done`}
          {" → "}{t("nav.allShelf")}
        </button>
      </div>
    </div>
  );
}
