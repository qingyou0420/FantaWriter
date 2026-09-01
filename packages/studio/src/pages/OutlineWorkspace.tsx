/**
 * Outline workspace: one tree + in-place detail + a single 织卷 entry.
 * Selected chapter always exposes 写这一章 / 查看正文. No second optimize-outline.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fetchJson, useApi } from "../hooks/use-api";
import { useEffect, useMemo, useState } from "react";
import { BookWorkspaceNav, type BookWorkspaceNavTarget } from "../components/BookWorkspaceNav";
import { startWriteNext } from "../components/SerialCockpitStrip";
import type { WritePreflightEvaluation } from "../components/SerialCockpitStrip";
import {
  applyVolumeMapNodeEdit,
  findNodeById,
  insertChapterStub,
  parseVolumeMapTree,
  recommendedOutlineNodeId,
  type VolumeMapChapterNode,
} from "../lib/volume-map-tree";
import { resolveWriteThisChapterAction } from "../lib/serial-cockpit";
import { useChatStore } from "../store/chat";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { ChevronLeft, Feather, Plus, Zap, Eye } from "lucide-react";

interface ChapterMeta {
  readonly number: number;
  readonly title: string;
  readonly status: string;
}

interface BookData {
  readonly book: { readonly id: string; readonly title: string; readonly language?: string };
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly nextChapter: number;
}

interface Nav extends BookWorkspaceNavTarget {
  toDashboard: () => void;
  toChapter: (bookId: string, num: number) => void;
}

type Filter = "all" | "todo" | "done";

function chapterWritten(chapters: ReadonlyArray<ChapterMeta>, number: number): boolean {
  return chapters.some((chapter) => chapter.number === number);
}

function nodeVisible(
  node: VolumeMapChapterNode,
  filter: Filter,
  query: string,
  written: ReadonlySet<number>,
): boolean {
  const end = node.endChapter ?? node.chapterNumber;
  const isDone = Array.from({ length: end - node.chapterNumber + 1 }, (_, index) => node.chapterNumber + index)
    .every((num) => written.has(num));
  if (filter === "todo" && isDone) return false;
  if (filter === "done" && !isDone) return false;
  if (!query) return true;
  const hay = `${node.title} ${node.summary} ${node.chapterNumber}`.toLowerCase();
  return hay.includes(query);
}

export function OutlineWorkspace({
  bookId,
  nav,
  theme: _theme,
  t,
}: {
  bookId: string;
  nav: Nav;
  theme: Theme;
  t: TFunction;
}) {
  const { data, loading, error, refetch } = useApi<BookData>(`/books/${bookId}`);
  const [volumeMap, setVolumeMap] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [preflight, setPreflight] = useState<WritePreflightEvaluation | null>(null);
  const [writePending, setWritePending] = useState(false);
  const setInput = useChatStore((state) => state.setInput);

  const isZh = data?.book.language !== "en";
  const tree = useMemo(() => parseVolumeMapTree(volumeMap), [volumeMap]);
  const written = useMemo(
    () => new Set((data?.chapters ?? []).filter((chapter) => chapter.status).map((chapter) => chapter.number)),
    [data?.chapters],
  );

  useEffect(() => {
    void fetchJson<{ content?: string | null }>(`/books/${bookId}/truth/outline/volume_map.md`)
      .then((body) => setVolumeMap(body.content ?? ""))
      .catch(() => setVolumeMap(""));
  }, [bookId]);

  useEffect(() => {
    if (!data) return;
    void fetchJson<WritePreflightEvaluation>(`/books/${bookId}/write-preflight`)
      .then(setPreflight)
      .catch(() => setPreflight(null));
  }, [bookId, data?.nextChapter]);

  useEffect(() => {
    if (selectedId || !data) return;
    setSelectedId(recommendedOutlineNodeId(tree, data.nextChapter));
  }, [data, selectedId, tree]);

  const selected = selectedId ? findNodeById(tree, selectedId) : undefined;

  useEffect(() => {
    if (!selected) return;
    setTitleDraft(selected.title);
    setSummaryDraft(selected.kind === "volume" ? selected.okr : selected.summary);
  }, [selected]);

  const visibleVolumes = tree.volumes
    .map((volume) => ({
      ...volume,
      chapters: volume.chapters.filter((node) => nodeVisible(node, filter, query.trim().toLowerCase(), written)),
    }))
    .filter((volume) => {
      if (volume.chapters.length > 0) return true;
      if (query && !`${volume.title} ${volume.okr}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return filter === "all";
    });
  const visibleOrphans = tree.orphanChapters.filter((node) => nodeVisible(node, filter, query.trim().toLowerCase(), written));
  const writtenCount = data?.chapters.length ?? 0;

  const openWeave = () => {
    const next = data?.nextChapter ?? 1;
    setInput(isZh
      ? `请织卷：为第 ${next} 章补 volume_map 章级条目与本卷 OKR。正典改动必须走确认闸，不要直接覆盖未确认草稿。`
      : `Please 织卷: add a volume_map entry for chapter ${next} and this volume's OKR. Canon edits must go through the confirm gate.`);
    nav.toBookChat(bookId);
  };

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const next = applyVolumeMapNodeEdit(volumeMap, selected.id, { title: titleDraft, summary: summaryDraft });
      await fetchJson(`/books/${bookId}/truth/outline/volume_map.md`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      setVolumeMap(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addFirstChapter = async () => {
    const next = insertChapterStub(volumeMap, data?.nextChapter ?? 1);
    setSaving(true);
    try {
      await fetchJson(`/books/${bookId}/truth/outline/volume_map.md`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: next }),
      });
      setVolumeMap(next);
      setSelectedId(`chapter:${data?.nextChapter ?? 1}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const selectedChapterNumber = selected && selected.kind !== "volume"
    ? selected.chapterNumber
    : data?.nextChapter;
  const writeAction = selectedChapterNumber && data && preflight
    ? resolveWriteThisChapterAction({
        selectedChapter: selectedChapterNumber,
        nextChapter: data.nextChapter,
        written: chapterWritten(data.chapters, selectedChapterNumber),
        preflight,
        isZh,
      })
    : null;

  const handleWriteThis = async () => {
    if (!writeAction || !data) return;
    if (writeAction.kind === "view") {
      nav.toChapter(bookId, writeAction.chapterNumber);
      return;
    }
    if (!writeAction.enabled) return;
    setWritePending(true);
    try {
      await startWriteNext(bookId, false);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setWritePending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
      </div>
    );
  }
  if (error) return <div className="text-destructive p-8">Error: {error}</div>;
  if (!data) return null;

  const empty = tree.volumeCount === 0 && tree.chapterCount === 0;

  return (
    <div className="space-y-5 fade-in" data-testid="outline-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <button type="button" onClick={nav.toDashboard} className="hover:text-primary flex items-center gap-1">
            <ChevronLeft size={14} />
            {t("bread.books")}
          </button>
          <span className="text-border">/</span>
          <button type="button" onClick={() => nav.toBook(bookId)} className="hover:text-primary">{data.book.title}</button>
          <span className="text-border">/</span>
          <span className="text-foreground">{isZh ? "大纲" : "Outline"}</span>
        </nav>
        <BookWorkspaceNav bookId={bookId} active="outline" nav={nav} isZh={isZh} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground" data-testid="outline-stats">
          {tree.volumeCount} {isZh ? "卷" : "vol"} · {tree.chapterCount} {isZh ? "章" : "ch"} · {writtenCount} {isZh ? "已写" : "written"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="outline-weave"
            onClick={openWeave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            <Feather size={14} />
            {isZh ? "织卷" : "织卷"}
          </button>
          <button
            type="button"
            onClick={() => void addFirstChapter()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-bold"
          >
            <Plus size={14} />
            {isZh ? "新增一章" : "Add chapter"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isZh ? "搜索卷 / 章" : "Search"}
          className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-sm outline-none focus:border-primary/50"
        />
        {(["all", "todo", "done"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${filter === item ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}
          >
            {item === "all" ? (isZh ? "全部" : "All") : item === "todo" ? (isZh ? "待写" : "To write") : (isZh ? "已写" : "Written")}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="rounded-2xl border border-border/40 px-6 py-12 text-center space-y-4" data-testid="outline-empty">
          <p className="text-sm text-muted-foreground">
            {isZh ? "还没有章级大纲。推荐先让织卷排纲（走确认闸），或手工占一章。" : "No chapter outline yet. Prefer 织卷 (confirm gate), or add a stub chapter."}
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={openWeave} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              {isZh ? "织卷 · 排大纲" : "织卷 · Outline"}
            </button>
            <button type="button" onClick={() => void addFirstChapter()} className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold">
              {isZh ? "新增第一章" : "Add chapter 1"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[280px_1fr]" data-testid="outline-split">
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            {visibleVolumes.map((volume) => (
              <div key={volume.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(volume.id)}
                  className={`w-full px-3 py-2 text-left text-sm font-medium border-b border-border/30 ${
                    selectedId === volume.id ? "bg-primary/10 text-primary" : "hover:bg-muted/30"
                  }`}
                >
                  {volume.title || (isZh ? "未命名卷" : "Untitled volume")}
                </button>
                {volume.chapters.map((node) => (
                  <ChapterRow
                    key={node.id}
                    node={node}
                    selected={selectedId === node.id}
                    written={written.has(node.chapterNumber)}
                    onClick={() => setSelectedId(node.id)}
                    isZh={isZh}
                  />
                ))}
              </div>
            ))}
            {visibleOrphans.map((node) => (
              <ChapterRow
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                written={written.has(node.chapterNumber)}
                onClick={() => setSelectedId(node.id)}
                isZh={isZh}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-border/40 p-5 space-y-4 min-h-[360px]" data-testid="outline-detail">
            {!selected ? (
              <p className="text-sm text-muted-foreground">{isZh ? "选中一章或一卷" : "Select a node"}</p>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  {selected.kind === "volume"
                    ? (isZh ? "卷" : "Volume")
                    : (isZh ? `第 ${selected.chapterNumber} 章` : `Chapter ${selected.chapterNumber}`)}
                </div>
                <input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => void saveSelected()}
                  className="w-full rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 font-serif text-xl outline-none focus:border-primary/50"
                />
                <textarea
                  value={summaryDraft}
                  onChange={(event) => setSummaryDraft(event.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-sm leading-6 outline-none focus:border-primary/50"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveSelected()}
                    disabled={saving}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {saving ? t("common.loading") : (isZh ? "保存" : "Save")}
                  </button>
                  {writeAction && (
                    <button
                      type="button"
                      data-testid="outline-write-this"
                      disabled={writeAction.kind !== "view" && (!writeAction.enabled || writePending)}
                      title={!writeAction.enabled ? writeAction.reasons.map((reason) => isZh ? reason.messageZh : reason.message).join(" ") : undefined}
                      onClick={() => void handleWriteThis()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {writeAction.kind === "view" ? <Eye size={14} /> : <Zap size={14} />}
                      {writeAction.kind === "view"
                        ? (isZh ? "查看正文" : "Open manuscript")
                        : (isZh ? "落墨 · 写这一章" : "落墨 · Write this chapter")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openWeave}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs font-bold"
                  >
                    <Feather size={14} />
                    {isZh ? "织卷" : "织卷"}
                  </button>
                </div>
                {writeAction && !writeAction.enabled && writeAction.kind !== "view" && (
                  <ul className="space-y-1 text-sm text-destructive" data-testid="outline-write-reasons">
                    {writeAction.reasons.map((reason) => (
                      <li key={reason.code}>{isZh ? reason.messageZh : reason.message}</li>
                    ))}
                  </ul>
                )}
                {selected.kind === "volume" && data.nextChapter > (selected.endChapter ?? 0) && selected.endChapter && (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-3 text-sm" data-testid="outline-volume-close">
                    {isZh ? "本卷已写完。过卷是里程碑：用织卷起草下一卷，不要常驻一个过卷页。" : "This volume is complete. Use 织卷 to draft the next volume — volume close is not a tab."}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterRow({
  node,
  selected,
  written,
  onClick,
  isZh,
}: {
  readonly node: VolumeMapChapterNode;
  readonly selected: boolean;
  readonly written: boolean;
  readonly onClick: () => void;
  readonly isZh: boolean;
}) {
  const label = node.kind === "range" && node.endChapter
    ? (isZh ? `第 ${node.chapterNumber}-${node.endChapter} 章` : `Ch. ${node.chapterNumber}-${node.endChapter}`)
    : (isZh ? `第 ${node.chapterNumber} 章` : `Ch. ${node.chapterNumber}`);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-5 py-1.5 text-left text-sm border-b border-border/20 ${
        selected ? "bg-primary/10 text-primary" : "hover:bg-muted/30 text-muted-foreground"
      }`}
    >
      <span className="text-[11px]">{written ? "✓" : "○"}</span>
      <span className="truncate">{label}{node.title ? ` ${node.title}` : ""}</span>
    </button>
  );
}
