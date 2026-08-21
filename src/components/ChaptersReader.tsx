"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TagSelector } from "@/components/TagEditor";
import { useToast } from "@/components/Toast";
import {
  buildPreviousContext,
  formatPlotThreadsForPrompt,
  postGenerate,
  streamGenerate,
} from "@/lib/api";
import { exportBook } from "@/lib/export-book";
import { attachOriginalContext } from "@/lib/original";
import { exportChaptersToRepo } from "@/lib/export-chapters";
import { loadReaderPrefs, saveReaderPrefs } from "@/lib/storage";
import type { RewriteMode } from "@/lib/prompts";
import {
  DEFAULT_READER_PREFS,
  pushChapterVersion,
  type ChapterContent,
  type ChapterScene,
  type ChapterVersion,
  type NovelProject,
  type OutlineChapter,
  type ReaderPrefs,
} from "@/lib/types";

const FONT_MIN = 14;
const FONT_MAX = 28;

const REWRITE_OPTIONS: { id: RewriteMode; label: string }[] = [
  { id: "polish", label: "润色" },
  { id: "expand", label: "扩写" },
  { id: "shorten", label: "精简" },
  { id: "dialogue", label: "对话" },
  { id: "custom", label: "自定义" },
];

function clampFont(n: number) {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)));
}

export function ChaptersReader({
  project,
  library,
  selectedChapterId,
  selectedContent,
  busy,
  onSelect,
  onGenerateChapter,
  onContentChange,
  onChapterTagsChange,
  onGenerateAll,
  onCancel,
  onUpdateChapterMeta,
  onBusy,
  onError,
}: {
  project: NovelProject;
  library: string[];
  selectedChapterId: string | null;
  selectedContent: ChapterContent | null;
  busy: string | null;
  onSelect: (id: string) => void;
  onGenerateChapter: (ch: OutlineChapter) => void;
  onContentChange: (chapterId: string, content: string, opts?: { pushVersion?: string }) => void;
  onChapterTagsChange: (chapterId: string, tags: string[]) => void;
  onGenerateAll: () => void;
  onCancel: () => void;
  onUpdateChapterMeta: (
    chapterId: string,
    patch: Partial<ChapterContent>
  ) => void;
  onBusy: (v: string | null) => void;
  onError: (msg: string) => void;
}) {
  const [metaOpen, setMetaOpen] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [immersive, setImmersive] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [showVersions, setShowVersions] = useState(false);
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("polish");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [continueHint, setContinueHint] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0, text: "" });
  const [localStreaming, setLocalStreaming] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();

  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];

  useEffect(() => {
    setPrefs(loadReaderPrefs());
  }, []);


  const persistPrefs = useCallback((next: ReaderPrefs) => {
    setPrefs(next);
    saveReaderPrefs(next);
  }, []);

  const setFontSize = useCallback(
    (n: number | ((p: number) => number)) => {
      setPrefs((prev) => {
        const size = clampFont(
          typeof n === "function" ? n(prev.fontSize) : n
        );
        const next = { ...prev, fontSize: size };
        saveReaderPrefs(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "SELECT" ||
        (tag === "TEXTAREA" && !target?.classList.contains("reader-textarea"))
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setFontSize((s) => s + 1);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setFontSize((s) => s - 1);
      } else if (e.key === "0") {
        e.preventDefault();
        setFontSize(DEFAULT_READER_PREFS.fontSize);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setFontSize]);

  const selectedOutline = chapters.find((c) => c.id === selectedChapterId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      if (!selectedOutline || busy) return;
      e.preventDefault();
      onGenerateChapter(selectedOutline);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedOutline, busy, onGenerateChapter]);
  const wordCount = (selectedContent?.content || "").replace(/\s/g, "").length;
  const chapterTagCount = selectedOutline?.tags?.length || 0;
  const content = selectedContent?.content || "";
  const displayContent =
    busy?.startsWith("chapter:") ||
    busy === "rewrite" ||
    busy === "continue" ||
    busy === "scene_gen"
      ? localStreaming || content
      : content;

  const findMatches = useMemo(() => {
    if (!findQuery) return [] as number[];
    const indices: number[] = [];
    const src = content;
    const q = findQuery;
    let from = 0;
    while (from < src.length) {
      const i = src.indexOf(q, from);
      if (i < 0) break;
      indices.push(i);
      from = i + Math.max(1, q.length);
    }
    return indices;
  }, [content, findQuery]);

  useEffect(() => {
    setFindIndex(0);
  }, [findQuery, selectedChapterId]);

  function captureSelection() {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    // 避免每次按键都 setState 触发重渲染，打断中文输入法组合
    setSelection((prev) => {
      if (prev.start === start && prev.end === end) return prev;
      return {
        start,
        end,
        text: el.value.slice(start, end),
      };
    });
  }

  function jumpFind(dir: 1 | -1) {
    if (!findMatches.length || !selectedOutline) return;
    const next =
      (findIndex + dir + findMatches.length) % findMatches.length;
    setFindIndex(next);
    const pos = findMatches[next];
    const el = taRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos + findQuery.length);
    }
  }

  function replaceOne() {
    if (!selectedOutline || !findQuery || !findMatches.length) return;
    const pos = findMatches[findIndex] ?? findMatches[0];
    const next =
      content.slice(0, pos) +
      replaceQuery +
      content.slice(pos + findQuery.length);
    onContentChange(selectedOutline.id, next);
  }

  function replaceAll() {
    if (!selectedOutline || !findQuery) return;
    if (!content.includes(findQuery)) return;
    onContentChange(
      selectedOutline.id,
      content.split(findQuery).join(replaceQuery)
    );
  }

  async function runRewrite() {
    if (!selectedOutline) return;
    captureSelection();
    const el = taRef.current;
    const start = el?.selectionStart ?? selection.start;
    const end = el?.selectionEnd ?? selection.end;
    const selectedText = content.slice(start, end);
    if (!selectedText.trim()) {
      onError("请先在正文中选中要改写的段落");
      return;
    }
    onError("");
    onBusy("rewrite");
    setLocalStreaming(content);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // push version via parent when applying - we'll replace selection
      const rewritten = await streamGenerate(
        attachOriginalContext(project, {
          mode: "rewrite",
          writingBoard: project.writingBoard,
          rewriteMode,
          selectedText,
          fullContext: content,
          instruction: rewriteInstruction,
          characters: project.characters,
          background: project.background,
          settings: project.settings,
        }),
        {
          signal: ac.signal,
          onDelta: (_d, full) => {
            const preview =
              content.slice(0, start) + full + content.slice(end);
            setLocalStreaming(preview);
          },
        }
      );
      const next = content.slice(0, start) + rewritten + content.slice(end);
      onContentChange(selectedOutline.id, next, { pushVersion: "rewrite" });
      setLocalStreaming("");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        onError("已取消改写");
      } else {
        onError(e instanceof Error ? e.message : String(e));
      }
      setLocalStreaming("");
    } finally {
      onBusy(null);
      abortRef.current = null;
    }
  }

  async function runContinue() {
    if (!selectedOutline) return;
    onError("");
    onBusy("continue");
    const base = content;
    setLocalStreaming(base);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const prior = buildPreviousContext(project, selectedOutline.order);
      const cont = await streamGenerate(
        attachOriginalContext(project, {
          mode: "continue",
          writingBoard: project.writingBoard,
          existingText: base,
          instruction: continueHint,
          characters: project.characters,
          background: project.background,
          settings: project.settings,
          chapter: selectedOutline,
          previousSummary: prior.previousSummaries,
          characterStateCard: prior.characterStateCard,
          plotThreads:
            prior.plotThreads ||
            formatPlotThreadsForPrompt(project.plotThreads),
          lore: prior.lore,
          priorBlock: prior.priorBlock,
        }),
        {
          signal: ac.signal,
          onDelta: (_d, full) => setLocalStreaming(base + full),
        }
      );
      onContentChange(selectedOutline.id, base + cont, {
        pushVersion: "continue",
      });
      setLocalStreaming("");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        onError("已取消续写");
      } else {
        onError(e instanceof Error ? e.message : String(e));
      }
      setLocalStreaming("");
    } finally {
      onBusy(null);
      abortRef.current = null;
    }
  }

  async function planScenes() {
    if (!selectedOutline) return;
    onError("");
    onBusy("scene_plan");
    try {
      const data = await postGenerate(
        attachOriginalContext(project, {
          mode: "scene_plan",
          writingBoard: project.writingBoard,
          characters: project.characters,
          background: project.background,
          settings: project.settings,
          chapter: selectedOutline,
          projectTags: project.tags || [],
        })
      );
      const scenes: ChapterScene[] = (data.scenes || []).map(
        (
          s: { order: number; title: string; summary: string },
          i: number
        ) => ({
          id: crypto.randomUUID(),
          order: s.order || i + 1,
          title: s.title,
          summary: s.summary,
        })
      );
      onUpdateChapterMeta(selectedOutline.id, { scenes });
      setMetaOpen(true);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
    }
  }

  async function generateByScenes() {
    if (!selectedOutline || !selectedContent?.scenes?.length) {
      onError("请先「规划场景」");
      return;
    }
    if (
      selectedContent.content &&
      !confirm("将按场景顺序生成并拼接正文（覆盖当前章），是否继续？")
    ) {
      return;
    }
    onError("");
    onBusy("scene_gen");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const prior = buildPreviousContext(project, selectedOutline.order);
    let assembled = "";
    setLocalStreaming("");
    try {
      if (selectedContent.content) {
        onContentChange(selectedOutline.id, selectedContent.content, {
          pushVersion: "before-scenes",
        });
      }
      for (const scene of [...selectedContent.scenes].sort(
        (a, b) => a.order - b.order
      )) {
        if (ac.signal.aborted) break;
        const piece = await streamGenerate(
          attachOriginalContext(project, {
            mode: "scene_chapter",
            writingBoard: project.writingBoard,
            characters: project.characters,
            background: project.background,
            settings: project.settings,
            chapter: selectedOutline,
            scene: {
              order: scene.order,
              title: scene.title,
              summary: scene.summary,
            },
            previousScenesText: assembled,
            previousChapterSnippet: prior.previousSnippet,
            previousSummaries: prior.previousSummaries,
            characterStateCard: prior.characterStateCard,
            priorBlock: prior.priorBlock,
            projectTags: project.tags || [],
            plotThreads:
              prior.plotThreads ||
              formatPlotThreadsForPrompt(project.plotThreads),
            lore: prior.lore,
          }),
          {
            signal: ac.signal,
            onDelta: (_d, full) =>
              setLocalStreaming(
                assembled + (assembled ? "\n\n" : "") + full
              ),
          }
        );
        assembled += (assembled ? "\n\n" : "") + piece;
        setLocalStreaming(assembled);
      }
      onContentChange(selectedOutline.id, assembled);
      setLocalStreaming("");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        onError("已取消场景生成");
        if (assembled) onContentChange(selectedOutline.id, assembled);
      } else {
        onError(e instanceof Error ? e.message : String(e));
      }
      setLocalStreaming("");
    } finally {
      onBusy(null);
      abortRef.current = null;
    }
  }

  async function writeChapterToRepo() {
    if (!selectedOutline) return;
    onError("");
    onBusy("repo_export");
    try {
      const result = await exportChaptersToRepo(project, {
        mode: "current",
        currentChapterId: selectedOutline.id,
      });
      if (!result.ok) throw new Error(result.message);
      toast.success(result.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
    }
  }

  function restoreVersion(v: ChapterVersion) {
    if (!selectedOutline) return;
    if (!confirm("恢复此版本？当前正文会进入历史。")) return;
    onContentChange(selectedOutline.id, v.content, {
      pushVersion: "before-restore",
    });
    setShowVersions(false);
  }

  const fontFamilyCss =
    prefs.fontFamily === "serif"
      ? 'Georgia, "Songti SC", "SimSun", serif'
      : prefs.fontFamily === "mono"
        ? 'ui-monospace, "Cascadia Code", Consolas, monospace'
        : prefs.fontFamily === "sans"
          ? '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
          : "inherit";

  const readerStyle = {
    ["--reader-font-size" as string]: `${prefs.fontSize}px`,
    ["--reader-line-height" as string]: String(prefs.lineHeight),
    ["--reader-max-width" as string]: `${prefs.lineWidth}rem`,
    ["--reader-font-family" as string]: fontFamilyCss,
  };

  if (!chapters.length) {
    return (
      <div className="card empty">
        请先在「大纲」页生成并确认章节结构。
      </div>
    );
  }

  return (
    <div
      className={`reader-shell grid lg:grid-cols-[220px_minmax(0,1fr)] gap-3 flex-1 min-h-0 ${
        immersive ? "reader-immersive" : ""
      } reader-theme-${prefs.theme}`}
      style={readerStyle}
    >
      <aside
        className={`card !p-2 flex flex-col min-h-0 overflow-hidden ${
          immersive ? "reader-chrome-hide" : ""
        }`}
      >
        <div className="flex items-center justify-between px-2 py-1.5 mb-1 shrink-0">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            章节（{chapters.length}）
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!!busy}
            onClick={onGenerateAll}
          >
            全部生成
          </button>
        </div>
        <ul className="list-none p-0 m-0 space-y-0.5 flex-1 min-h-0 overflow-y-auto">
          {chapters.map((ch) => {
            const c = project.chapters.find((x) => x.chapterId === ch.id);
            const status = c?.status || "idle";
            return (
              <li key={ch.id}>
                <button
                  type="button"
                  className={`w-full text-left px-2.5 py-2.5 rounded-lg border-0 cursor-pointer text-sm ${
                    ch.id === selectedChapterId
                      ? "bg-[var(--bg-hover)] text-[var(--text)]"
                      : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg)]"
                  }`}
                  onClick={() => onSelect(ch.id)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">
                      {ch.order}. {ch.title}
                    </span>
                    <StatusDot status={status} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 mt-2 space-y-1">
          <button
            type="button"
            className="btn btn-primary btn-sm w-full"
            disabled={!!busy || !selectedOutline}
            onClick={() => void writeChapterToRepo()}
          >
            {busy === "repo_export" ? (
              <>
                <span className="spinner" /> 写入中
              </>
            ) : (
              "把本章写进仓库"
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm w-full"
            onClick={() => exportBook(project, "md")}
          >
            导出全书 Markdown
          </button>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportBook(project, "txt")}
            >
              TXT
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportBook(project, "epub")}
            >
              EPUB
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => exportBook(project, "doc")}
            >
              DOC
            </button>
          </div>
        </div>
      </aside>

      <div className="card reader-panel flex flex-col min-h-0 overflow-hidden !p-0">
        {selectedOutline ? (
          <>
            <div
              className={`shrink-0 px-4 sm:px-5 pt-3.5 pb-2.5 border-b border-[var(--border-soft)] ${
                immersive ? "reader-chrome-hide" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold m-0 flex-1 min-w-[10rem]">
                  第 {selectedOutline.order} 章 · {selectedOutline.title}
                </h2>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  {wordCount > 0
                    ? `${wordCount.toLocaleString()} 字`
                    : "暂无正文"}
                </span>
                {busy ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      abortRef.current?.abort();
                      onCancel();
                    }}
                  >
                    停止
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!!busy}
                  onClick={() => onGenerateChapter(selectedOutline)}
                >
                  {busy === `chapter:${selectedOutline.id}` ? (
                    <>
                      <span className="spinner" /> 生成中
                    </>
                  ) : selectedContent?.status === "done" ? (
                    "重新生成"
                  ) : (
                    "生成本章"
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1 mt-2">
                <div className="reader-tool-group">
                  <span className="reader-tool-label">阅读</span>
                  <div className="reader-font-controls" title="字号">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={prefs.fontSize <= FONT_MIN}
                      onClick={() => setFontSize((s) => s - 1)}
                    >
                      A−
                    </button>
                    <span
                      className="reader-font-value"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setFontSize(DEFAULT_READER_PREFS.fontSize)
                      }
                    >
                      {prefs.fontSize}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={prefs.fontSize >= FONT_MAX}
                      onClick={() => setFontSize((s) => s + 1)}
                    >
                      A+
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm ${showReaderSettings ? "!text-[var(--accent-text)]" : ""}`}
                    onClick={() => {
                      setShowReaderSettings((v) => !v);
                      setFindOpen(false);
                      setShowVersions(false);
                      setMetaOpen(false);
                    }}
                  >
                    设置
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm ${findOpen ? "!text-[var(--accent-text)]" : ""}`}
                    onClick={() => {
                      setFindOpen((v) => !v);
                      setShowReaderSettings(false);
                      setShowVersions(false);
                    }}
                  >
                    查找
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setImmersive((v) => !v)}
                  >
                    {immersive ? "退出沉浸" : "沉浸"}
                  </button>
                </div>
                <span className="reader-tool-sep" />
                <div className="reader-tool-group">
                  <span className="reader-tool-label">章节</span>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm ${metaOpen ? "!text-[var(--accent-text)]" : ""}`}
                    onClick={() => {
                      setMetaOpen((v) => !v);
                      setShowReaderSettings(false);
                      setFindOpen(false);
                      setShowVersions(false);
                    }}
                  >
                    大纲/场景
                    {chapterTagCount > 0 ? ` · ${chapterTagCount}` : ""}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-sm ${showVersions ? "!text-[var(--accent-text)]" : ""}`}
                    onClick={() => {
                      setShowVersions((v) => !v);
                      setShowReaderSettings(false);
                      setFindOpen(false);
                      setMetaOpen(false);
                    }}
                  >
                    版本
                    {(selectedContent?.versions?.length || 0) > 0
                      ? ` · ${selectedContent?.versions?.length}`
                      : ""}
                  </button>
                </div>
              </div>

              {showReaderSettings ? (
                <div className="mt-3 pt-3 border-t border-[var(--border-soft)] grid sm:grid-cols-4 gap-3 text-sm">
                  <label className="field">
                    <span className="field-label">字体</span>
                    <select
                      value={prefs.fontFamily}
                      onChange={(e) =>
                        persistPrefs({
                          ...prefs,
                          fontFamily: e.target
                            .value as ReaderPrefs["fontFamily"],
                        })
                      }
                    >
                      <option value="system">系统</option>
                      <option value="serif">衬线</option>
                      <option value="sans">无衬线</option>
                      <option value="mono">等宽</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">主题</span>
                    <select
                      value={prefs.theme}
                      onChange={(e) =>
                        persistPrefs({
                          ...prefs,
                          theme: e.target.value as ReaderPrefs["theme"],
                        })
                      }
                    >
                      <option value="default">默认</option>
                      <option value="paper">纸张</option>
                      <option value="night">深夜</option>
                      <option value="sepia">羊皮纸</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">
                      行宽 {prefs.lineWidth}rem
                    </span>
                    <input
                      type="range"
                      min={32}
                      max={72}
                      value={prefs.lineWidth}
                      onChange={(e) =>
                        persistPrefs({
                          ...prefs,
                          lineWidth: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      行高 {prefs.lineHeight.toFixed(1)}
                    </span>
                    <input
                      type="range"
                      min={1.4}
                      max={2.4}
                      step={0.1}
                      value={prefs.lineHeight}
                      onChange={(e) =>
                        persistPrefs({
                          ...prefs,
                          lineHeight: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}

              {findOpen ? (
                <div className="mt-3 pt-3 border-t border-[var(--border-soft)] flex flex-wrap gap-2 items-center">
                  <input
                    className="!w-auto min-w-[10rem] flex-1"
                    placeholder="查找"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                  />
                  <input
                    className="!w-auto min-w-[10rem] flex-1"
                    placeholder="替换为"
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                  />
                  <span className="text-xs text-[var(--text-muted)]">
                    {findMatches.length
                      ? `${findIndex + 1}/${findMatches.length}`
                      : "0"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => jumpFind(-1)}
                  >
                    上一个
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => jumpFind(1)}
                  >
                    下一个
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={replaceOne}
                  >
                    替换
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={replaceAll}
                  >
                    全部替换
                  </button>
                </div>
              ) : null}

              {showVersions ? (
                <div className="mt-3 pt-3 border-t border-[var(--border-soft)] max-h-40 overflow-y-auto">
                  {!(selectedContent?.versions?.length) ? (
                    <p className="text-sm text-[var(--text-muted)] m-0">
                      暂无历史版本。生成/改写前会自动快照。
                    </p>
                  ) : (
                    <ul className="list-none p-0 m-0 space-y-1">
                      {selectedContent!.versions!.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-[var(--text-muted)] truncate">
                            {v.label} ·{" "}
                            {new Date(v.createdAt).toLocaleString("zh-CN")} ·{" "}
                            {v.content.replace(/\s/g, "").length} 字
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm shrink-0"
                            onClick={() => restoreVersion(v)}
                          >
                            恢复
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {metaOpen ? (
                <div className="mt-3 pt-3 border-t border-[var(--border-soft)] space-y-2">
                  <p className="text-sm text-[var(--text-muted)] mt-0 mb-0 leading-relaxed">
                    {selectedOutline.summary}
                  </p>
                  {(project.tags || []).length > 0 ? (
                    <p className="text-[0.75rem] text-[var(--text-muted)] mt-0 mb-0">
                      本书标签：
                      <span className="text-[var(--accent-text)]">
                        {(project.tags || []).join("、")}
                      </span>
                    </p>
                  ) : null}
                  <TagSelector
                    library={library}
                    selected={selectedOutline.tags || []}
                    onChange={(tags) =>
                      onChapterTagsChange(selectedOutline.id, tags)
                    }
                    label="本章额外标签"
                    hint="勾选后重新生成时会强制写出这些行为。"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!busy}
                      onClick={planScenes}
                    >
                      {busy === "scene_plan" ? "规划中…" : "AI 规划场景"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!busy || !selectedContent?.scenes?.length}
                      onClick={generateByScenes}
                    >
                      按场景生成
                    </button>
                  </div>
                  {selectedContent?.scenes?.length ? (
                    <ol className="text-sm text-[var(--text-muted)] m-0 pl-4">
                      {selectedContent.scenes.map((s) => (
                        <li key={s.id}>
                          <strong className="text-[var(--text)]">
                            {s.title}
                          </strong>
                          ：{s.summary}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}

              {/* AI 润色 / 续写 */}
              <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
                <div className="reader-tool-group mb-1.5">
                  <span className="reader-tool-label">AI 改写</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    className="!w-auto"
                    value={rewriteMode}
                    onChange={(e) =>
                      setRewriteMode(e.target.value as RewriteMode)
                    }
                    disabled={!!busy}
                  >
                    {REWRITE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {rewriteMode === "custom" ? (
                    <input
                      className="!w-auto min-w-[8rem] flex-1"
                      value={rewriteInstruction}
                      onChange={(e) => setRewriteInstruction(e.target.value)}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy}
                    onClick={runRewrite}
                    title="选中文本后改写"
                  >
                    {busy === "rewrite" ? (
                      <>
                        <span className="spinner" /> 改写中
                      </>
                    ) : (
                      "改写选中"
                    )}
                  </button>
                  <span className="reader-tool-sep" />
                  <input
                    className="!w-auto min-w-[8rem] flex-1"
                    value={continueHint}
                    onChange={(e) => setContinueHint(e.target.value)}
                    disabled={!!busy}
                    aria-label="续写方向"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy}
                    onClick={runContinue}
                  >
                    {busy === "continue" ? (
                      <>
                        <span className="spinner" /> 续写中
                      </>
                    ) : (
                      "续写"
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!content}
                    onClick={() => {
                      if (content) navigator.clipboard.writeText(content);
                    }}
                  >
                    复制
                  </button>
                </div>
              </div>
            </div>

            {selectedContent?.status === "generating" &&
            !localStreaming &&
            !busy?.startsWith("chapter") ? (
              <div className="empty flex-1 flex items-center justify-center gap-2 min-h-[50vh]">
                <span className="spinner" /> AI 正在撰写正文…
              </div>
            ) : (
              <div className="reader-textarea-wrap flex-1 min-h-0 flex flex-col">
                <textarea
                  ref={taRef}
                  className="reader-textarea"
                  value={displayContent}
                  onSelect={captureSelection}
                  onMouseUp={captureSelection}
                  onKeyUp={captureSelection}
                  onChange={(e) => {
                    if (busy) return;
                    // 直接提交字符串；父级已防抖落盘，保证可增删改
                    onContentChange(selectedOutline.id, e.target.value);
                  }}
                  readOnly={!!busy}
                  spellCheck={false}
                />
              </div>
            )}
            {selectedContent?.status === "error" ? (
              <p className="text-xs text-[var(--danger-text)] m-0 px-5 py-2 border-t border-[var(--border-soft)] shrink-0">
                {selectedContent.error}
              </p>
            ) : null}
          </>
        ) : (
          <div className="empty flex-1 flex items-center justify-center">
            选择左侧章节
          </div>
        )}
      </div>

      {immersive ? (
        <button
          type="button"
          className="reader-exit-immersive btn btn-secondary btn-sm"
          onClick={() => setImmersive(false)}
        >
          退出沉浸
        </button>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: ChapterContent["status"] }) {
  const map: Record<ChapterContent["status"], string> = {
    idle: "bg-[var(--border)]",
    generating: "bg-[var(--warning)] animate-pulse",
    done: "bg-[var(--success)]",
    error: "bg-[var(--danger)]",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status]}`}
      title={status}
    />
  );
}

// re-export helper for page if needed
export { pushChapterVersion };
