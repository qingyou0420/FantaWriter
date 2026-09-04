import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { putApi, useApi } from "../hooks/use-api";
import type { TFunction } from "../hooks/use-i18n";
import { shortManuscriptExportPath } from "../lib/work-export";
import type { StudioShortDetail } from "../shared/short-works";

interface Nav {
  toDashboard: () => void;
  toShort: (id: string) => void;
}

export function ShortSettings({ storyId, nav, t }: {
  storyId: string;
  nav: Nav;
  t: TFunction;
}) {
  const { data, loading, error, refetch } = useApi<StudioShortDetail>(`/shorts/${encodeURIComponent(storyId)}`);
  const [title, setTitle] = useState("");
  const [chapterCount, setChapterCount] = useState(12);
  const [direction, setDirection] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setChapterCount(data.chapterCount ?? 12);
    setDirection(data.direction ?? "");
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await putApi(`/shorts/${encodeURIComponent(storyId)}`, {
        title,
        chapterCount,
        direction: direction.trim(),
      });
      setMessage(t("short.saved"));
      await refetch();
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (error) return <div className="text-destructive">{t("common.error")}: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <button type="button" onClick={nav.toDashboard} className="hover:text-primary transition-colors flex items-center gap-1">
          <ChevronLeft size={14} />
          {t("bread.books")}
        </button>
        <span className="text-border">/</span>
        <button type="button" onClick={() => nav.toShort(storyId)} className="hover:text-primary">
          {data.title}
        </button>
        <span className="text-border">/</span>
        <span className="text-foreground">{t("short.settings")}</span>
      </nav>

      <div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t("short.badge")}</span>
        <h1 className="mt-3 font-serif text-3xl">{t("short.settings")}</h1>
      </div>

      <div className="paper-sheet rounded-2xl border border-border/40 p-6 space-y-5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("create.bookTitle")}</label>
          <input
            data-testid="short-settings-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-secondary/30 outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("create.targetChapters")}</label>
          <input
            data-testid="short-settings-chapters"
            type="number"
            min={1}
            value={chapterCount}
            onChange={(event) => setChapterCount(Number(event.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-secondary/30 outline-none focus:border-primary/50 w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("short.direction")}</label>
          <textarea
            data-testid="short-settings-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            placeholder={t("short.directionPlaceholder")}
            rows={4}
            className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-secondary/30 outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="short-settings-save"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
            className="px-5 py-2.5 text-sm font-bold rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? t("book.saving") : t("book.save")}
          </button>
          <a
            href={shortManuscriptExportPath(storyId)}
            download
            data-testid="short-settings-export"
            className="px-5 py-2.5 text-sm font-bold rounded-xl bg-secondary text-foreground"
          >
            {t("book.export")}
          </a>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
