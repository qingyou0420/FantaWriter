"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CastPicker } from "@/components/CastPicker";
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
import {
  chapterBelowMin,
  continueLengthRequirement,
  countChapterChars,
  expandTargetChars,
  lengthRangeFor,
} from "@/lib/length";
import { parseTouchedThreads, sliceAroundSelection } from "@/lib/prompts";
import { createThrottledTextSink } from "@/lib/stream-throttle";
import { BeatWorkbench } from "@/components/BeatWorkbench";
import { ChapterContractPanel } from "@/components/ChapterContractPanel";
import { FinalizePanel } from "@/components/FinalizePanel";
import { EmptyState } from "@/components/EmptyState";
import { collectChapterAnchors } from "@/lib/beat-contract";
import type { BeatCommitDeltas } from "@/lib/beat-contract";
import { readerKnownOpenThreadTitles } from "@/lib/author-secrets";
import {
  chapterHasUpstreamRepair,
  sortChaptersForDailyNav,
} from "@/lib/daily-flow";
import { extractCharacterDialogue } from "@/lib/dialogue-excerpt";
import type { CharacterStateDelta } from "@/lib/character-states";
import { formatCharacterStateLedger } from "@/lib/character-states";
import {
  chapterAssembleExtras,
  formatChapterContract,
} from "@/lib/chapter-contract";
import { globalForbidList } from "@/lib/author-secrets";
import type { FinalizeProgress } from "@/lib/finalize-chapter";
import type { PendingStateDelta } from "@/lib/types";
import { buildChapterHealth, type ChapterHealth } from "@/lib/chapter-health";
import { hasOriginalText } from "@/lib/original";
import { allowsWholeBookGenerate } from "@/lib/renewal";
import type { ChapterPersistResult } from "@/lib/renewal";
import { loadReaderPrefs, saveReaderPrefs } from "@/lib/storage";
import { chaptersGroupedByVolume } from "@/lib/volumes";
import type { RewriteMode } from "@/lib/prompts";
import {
  DEFAULT_READER_PREFS,
  LENGTH_LABELS,
  STYLE_LABELS,
  pushChapterVersion,
  type CharacterStateLedger,
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
  onChapterCastChange,
  onGenerateAll,
  onCancel,
  onUpdateChapterMeta,
  onCommitBeatDeltas,
  onBusy,
  onError,
  onOpenSettings,
  onWriteNext,
  onCharacterStatesChange: _onCharacterStatesChange,
  contractChapterId,
  onRequestContract,
  onPatchOutlineChapter,
  onFinalizeChapter,
  onHandEditSummary,
  onJumpPlot: _onJumpPlot,
  onJumpTools: _onJumpTools,
  hideLegacyFlow = false,
  onRerunReview,
  onRerunSettle,
}: {
  project: NovelProject;
  library: string[];
  selectedChapterId: string | null;
  selectedContent: ChapterContent | null;
  busy: string | null;
  onSelect: (id: string) => void;
  onGenerateChapter: (ch: OutlineChapter) => void;
  onContentChange: (
    chapterId: string,
    content: string,
    opts?: { pushVersion?: string; forceCanon?: boolean }
  ) => ChapterPersistResult | void;
  onCommitBeatDeltas?: (chapterId: string, deltas: BeatCommitDeltas) => void;
  onChapterTagsChange: (chapterId: string, tags: string[]) => void;
  onChapterCastChange: (chapterId: string, castIds: string[]) => void;
  onGenerateAll: () => void;
  onCancel: () => void;
  onUpdateChapterMeta: (
    chapterId: string,
    patch: Partial<ChapterContent>
  ) => void;
  onBusy: (v: string | null) => void;
  onError: (msg: string) => void;
  onOpenSettings?: () => void;
  onWriteNext?: () => void;
  onCharacterStatesChange?: (states: CharacterStateLedger) => void;
  contractChapterId?: string | null;
  onRequestContract?: (chapterId: string | null) => void;
  onPatchOutlineChapter?: (chapterId: string, patch: Partial<OutlineChapter>) => void;
  onFinalizeChapter?: (payload: {
    chapterId: string;
    chapterOrder: number;
    summary: string;
    deltas: PendingStateDelta[];
    pinnedNames: string[];
    threadActions: { title: string; action: "active" | "resolved" | "keep" }[];
    newThreadTitle: string;
    skipped: FinalizeProgress;
  }) => void;
  onHandEditSummary?: (chapterId: string, chapterOrder: number) => void;
  onJumpPlot?: () => void;
  onJumpTools?: () => void;
  hideLegacyFlow?: boolean;
  onRerunReview?: (chapterId: string) => void;
  onRerunSettle?: (chapterId: string) => void;
}) {
  const [metaOpen, setMetaOpen] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadReaderPrefs());
  const [immersive, setImmersive] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("polish");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [expandScale, setExpandScale] = useState<1.5 | 2>(2);
  const [continueHint, setContinueHint] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0, text: "" });
  const [localStreaming, setLocalStreaming] = useState("");
  const [blockedSave, setBlockedSave] = useState<{
    content: string;
    violations: string[];
  } | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [chapterHealth, setChapterHealth] = useState<ChapterHealth | null>(
    null
  );
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [summaryUiKey, setSummaryUiKey] = useState(selectedChapterId);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamSinkRef = useRef(
    createThrottledTextSink((full) => setLocalStreaming(full))
  );
  const toast = useToast();

  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  const navChapters = sortChaptersForDailyNav(chapters, project.chapters);
  const contractChapter =
    contractChapterId
      ? chapters.find((c) => c.id === contractChapterId) || null
      : null;

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

  function chapterContractExtras() {
    return selectedOutline
      ? chapterAssembleExtras(project, selectedOutline)
      : {};
  }

  function persistContent(
    next: string,
    opts?: { pushVersion?: string; forceCanon?: boolean }
  ): ChapterPersistResult | void {
    if (!selectedOutline) return;
    const result = onContentChange(selectedOutline.id, next, opts);
    if (result && !result.ok) {
      setBlockedSave({ content: next, violations: result.violations });
      onError("与锁定设定冲突，正文未保存。可继续改，或强制保存并警告。");
      return result;
    }
    setBlockedSave(null);
    if (result?.violations?.length) {
      onUpdateChapterMeta(selectedOutline.id, {
        canonWarnings: result.violations,
      });
    }
    return result;
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      if (!selectedOutline || busy) return;
      e.preventDefault();
      if (onRequestContract) onRequestContract(selectedOutline.id);
      else onGenerateChapter(selectedOutline);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedOutline, busy, onGenerateChapter, onRequestContract]);
  const content = selectedContent?.content || "";
  const wordCount = countChapterChars(content);
  const lengthRange = lengthRangeFor(
    project.settings.length,
    project.settings.customLength
  );
  const needsFill =
    !!content &&
    chapterBelowMin(
      content,
      project.settings.length,
      project.settings.customLength
    );
  const lengthLabel = project.settings.customLength
    ? `自定义（${lengthRange.min}–${lengthRange.max}字/章）`
    : LENGTH_LABELS[project.settings.length];
  const unreviewedCount = project.chapters.filter(
    (c) => c.content?.trim() && c.reviewState !== "reviewed"
  ).length;
  if (summaryUiKey !== selectedChapterId) {
    setSummaryUiKey(selectedChapterId);
    setEditingSummary(false);
    setChapterHealth(null);
    setSummaryDraft("");
  }
  const chapterTagCount = selectedOutline?.tags?.length || 0;
  const renewal = hasOriginalText(project.original);
  const displayContent =
    blockedSave?.content ??
    (busy?.startsWith("chapter:") ||
    busy === "rewrite" ||
    busy === "continue" ||
    busy === "scene_gen" ||
    busy?.startsWith("beat:")
      ? localStreaming || content
      : content);

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

  const findResetKey = `${findQuery}::${selectedChapterId || ""}`;
  const [findCursor, setFindCursor] = useState({ key: findResetKey, index: 0 });
  if (findCursor.key !== findResetKey) {
    setFindCursor({ key: findResetKey, index: 0 });
  }
  const findIndexEffective =
    findCursor.key === findResetKey ? findCursor.index : 0;

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
      (findIndexEffective + dir + findMatches.length) % findMatches.length;
    setFindCursor({ key: findResetKey, index: next });
    const pos = findMatches[next];
    const el = taRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos + findQuery.length);
    }
  }

  function replaceOne() {
    if (!selectedOutline || !findQuery || !findMatches.length) return;
    const pos = findMatches[findIndexEffective] ?? findMatches[0];
    const next =
      content.slice(0, pos) +
      replaceQuery +
      content.slice(pos + findQuery.length);
    persistContent(next);
  }

  function replaceAll() {
    if (!selectedOutline || !findQuery) return;
    if (!content.includes(findQuery)) return;
    persistContent(content.split(findQuery).join(replaceQuery), {
      pushVersion: "replace",
    });
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
      const prior = buildPreviousContext(project, selectedOutline.order);
      const windowCtx = sliceAroundSelection(content, start, end, 2000);
      const selectedChars = countChapterChars(selectedText);
      const rewritten = await streamGenerate(
        attachOriginalContext(project, {
          mode: "rewrite",
          writingBoard: project.writingBoard,
          rewriteMode,
          selectedText,
          fullContext: windowCtx,
          instruction: rewriteInstruction,
          characters: project.characters,
          background: project.background,
          settings: project.settings,
          priorBlock: prior.priorBlock,
          previousSummaries: prior.previousSummaries,
          chapter: selectedOutline,
          outline: project.outline,
          loreEntries: project.lore,
          expandScale: rewriteMode === "expand" ? expandScale : undefined,
          expandTargetChars:
            rewriteMode === "expand"
              ? expandTargetChars(selectedChars, expandScale)
              : undefined,
          verbatimAnchors: collectChapterAnchors(selectedContent?.scenes),
          ...chapterContractExtras(),
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
      persistContent(next, { pushVersion: "rewrite" });
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
          outline: project.outline,
          previousSummary: prior.previousSummaries,
          previousSummaries: prior.previousSummaries,
          characterStateCard: prior.characterStateCard,
          plotThreads:
            prior.plotThreads ||
            formatPlotThreadsForPrompt(project.plotThreads),
          lore: prior.lore,
          priorBlock: prior.priorBlock,
          loreEntries: project.lore,
          ...chapterContractExtras(),
        }),
        {
          signal: ac.signal,
          onDelta: (_d, full) => streamSinkRef.current.push(base + full),
        }
      );
      persistContent(base + cont, {
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
        persistContent(selectedContent.content, {
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
            ...chapterContractExtras(),
          }),
          {
            signal: ac.signal,
            onDelta: (_d, full) =>
              streamSinkRef.current.push(
                assembled + (assembled ? "\n\n" : "") + full
              ),
          }
        );
        assembled += (assembled ? "\n\n" : "") + piece;
        setLocalStreaming(assembled);
      }
      persistContent(assembled);
      setLocalStreaming("");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        onError("已取消场景生成");
        if (assembled) persistContent(assembled);
      } else {
        onError(e instanceof Error ? e.message : String(e));
      }
      setLocalStreaming("");
    } finally {
      onBusy(null);
      abortRef.current = null;
    }
  }

  async function fillToLength() {
    if (!selectedOutline || !content.trim()) return;
    onError("");
    onBusy("continue");
    const base = content;
    setLocalStreaming(base);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const prior = buildPreviousContext(project, selectedOutline.order);
      const instruction = continueLengthRequirement(
        project.settings,
        countChapterChars(base)
      );
      const extra = await streamGenerate(
        attachOriginalContext(project, {
          mode: "continue",
          writingBoard: project.writingBoard,
          existingText: base,
          instruction,
          characters: project.characters,
          background: project.background,
          settings: project.settings,
          chapter: selectedOutline,
          outline: project.outline,
          previousSummary: prior.previousSummaries,
          previousSummaries: prior.previousSummaries,
          characterStateCard: prior.characterStateCard,
          plotThreads:
            prior.plotThreads ||
            formatPlotThreadsForPrompt(project.plotThreads),
          lore: prior.lore,
          priorBlock: prior.priorBlock,
          loreEntries: project.lore,
          ...chapterContractExtras(),
        }),
        {
          signal: ac.signal,
          onDelta: (_d, full) => streamSinkRef.current.push(base + full),
        }
      );
      persistContent(base + extra, {
        pushVersion: "continue",
      });
      setLocalStreaming("");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        onError("已取消补足");
      } else {
        onError(e instanceof Error ? e.message : String(e));
      }
      setLocalStreaming("");
    } finally {
      onBusy(null);
      abortRef.current = null;
    }
  }

  async function regenerateSummary() {
    if (!selectedOutline || !content.trim()) return;
    onError("");
    onBusy("chapter_summary");
    try {
      const data = await postGenerate({
        mode: "chapter_summary",
        writingBoard: project.writingBoard,
        content,
        title: selectedOutline.title,
        openThreads: readerKnownOpenThreadTitles(project.plotThreads),
        settings: project.settings,
      });
      const raw = String(data.summary || "").trim();
      const deltas = Array.isArray(data.characterStates)
        ? (data.characterStates as CharacterStateDelta[])
        : [];
      onUpdateChapterMeta(selectedOutline.id, {
        summary: raw,
        summaryFailed: false,
        touchedThreads: Array.isArray(data.touchedThreads)
          ? data.touchedThreads
          : parseTouchedThreads(raw),
        pendingStateDeltas: deltas,
      });
      setEditingSummary(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
    }
  }

  async function runChapterHealth() {
    if (!selectedOutline || !content.trim()) {
      onError("该章尚无正文");
      return;
    }
    onError("");
    onBusy("chapter_health");
    try {
      const data = await postGenerate(
        attachOriginalContext(project, {
          mode: "outline_vs_content",
          writingBoard: project.writingBoard,
          chapter: selectedOutline,
          content,
          projectTags: project.tags || [],
        })
      );
      setChapterHealth(
        buildChapterHealth({
          outlineCheck: data.result,
          content,
          settings: project.settings,
          canon: project.canon,
          original: project.original,
          summary: selectedContent?.summary,
        })
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
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
    persistContent(v.content, {
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
            {unreviewedCount ? ` · ${unreviewedCount} 章未审` : ""}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSummaryOnly((v) => !v)}
          >
            {summaryOnly ? "看目录" : "只看摘要"}
          </button>
          {!hideLegacyFlow && allowsWholeBookGenerate(project) ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!!busy}
              onClick={onGenerateAll}
            >
              全部生成
            </button>
          ) : hideLegacyFlow ? null : (
            <span className="text-[0.7rem] text-[var(--text-muted)]">按拍扩写</span>
          )}
        </div>
        {onOpenSettings ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full mb-1 text-left !justify-start"
            onClick={onOpenSettings}
            title="打开生成参数"
          >
            篇幅 {lengthLabel} · 文风{" "}
            {STYLE_LABELS[project.settings.writingStyle] ||
              project.settings.writingStyle}{" "}
            · 温度 {project.settings.temperature ?? 0.9}
          </button>
        ) : null}
        <ul className="list-none p-0 m-0 space-y-0.5 flex-1 min-h-0 overflow-y-auto">
          {summaryOnly
            ? navChapters.map((ch) => {
                const c = project.chapters.find((x) => x.chapterId === ch.id);
                return (
                  <li key={ch.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-2 py-2 rounded-lg border-0 text-xs ${
                        ch.id === selectedChapterId
                          ? "bg-[var(--bg-hover)]"
                          : "bg-transparent text-[var(--text-muted)]"
                      }`}
                      onClick={() => onSelect(ch.id)}
                    >
                      <div className="font-medium">
                        {ch.order}. {ch.title}
                        {chapterHasUpstreamRepair(
                          ch.order,
                          project.accountRepairMarks
                        ) && c?.content?.trim()
                          ? " · 上游账已修"
                          : ""}
                      </div>
                      <textarea
                        rows={3}
                        className="mt-1 w-full text-xs"
                        value={c?.summary || ch.summary || ""}
                        onChange={(e) => {
                          onUpdateChapterMeta(ch.id, {
                            summary: e.target.value,
                          });
                          onHandEditSummary?.(ch.id, ch.order);
                        }}
                      />
                    </button>
                  </li>
                );
              })
            : (project.volumes || []).length > 1
            ? chaptersGroupedByVolume(project).map(({ volume, chapters: volChs }) => (
                <li key={volume.id}>
                  <div className="text-xs font-medium text-[var(--text-muted)] px-2 py-1">
                    {volume.title}
                  </div>
                  <ul className="list-none p-0 m-0 space-y-0.5">
                    {sortChaptersForDailyNav(volChs, project.chapters).map((ch) => {
                      const c = project.chapters.find((x) => x.chapterId === ch.id);
                      return (
                        <ChapterNavItem
                          key={ch.id}
                          ch={ch}
                          status={c?.status || "idle"}
                          words={countChapterChars(c?.content || "")}
                          selected={ch.id === selectedChapterId}
                          touched={c?.touchedThreads}
                          unreviewed={
                            Boolean(c?.content?.trim()) &&
                            c?.reviewState !== "reviewed"
                          }
                          repaired={
                            Boolean(c?.content?.trim()) &&
                            chapterHasUpstreamRepair(
                              ch.order,
                              project.accountRepairMarks
                            )
                          }
                          onSelect={onSelect}
                        />
                      );
                    })}
                  </ul>
                </li>
              ))
            : navChapters.map((ch) => {
                const c = project.chapters.find((x) => x.chapterId === ch.id);
                return (
                  <ChapterNavItem
                    key={ch.id}
                    ch={ch}
                    status={c?.status || "idle"}
                    words={countChapterChars(c?.content || "")}
                    selected={ch.id === selectedChapterId}
                    touched={c?.touchedThreads}
                    unreviewed={
                      Boolean(c?.content?.trim()) &&
                      c?.reviewState !== "reviewed"
                    }
                    repaired={
                      Boolean(c?.content?.trim()) &&
                      chapterHasUpstreamRepair(
                        ch.order,
                        project.accountRepairMarks
                      )
                    }
                    onSelect={onSelect}
                  />
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
              "把本章导出到文件夹"
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
        {contractChapter && onPatchOutlineChapter && !hideLegacyFlow ? (
          <div className="p-4 overflow-y-auto">
            <ChapterContractPanel
              project={project}
              chapter={contractChapter}
              busy={!!busy}
              onPatchChapter={(patch) =>
                onPatchOutlineChapter(contractChapter.id, patch)
              }
              onCancel={() => onRequestContract?.(null)}
              onGenerate={() => {
                onRequestContract?.(null);
                onGenerateChapter(contractChapter);
              }}
            />
          </div>
        ) : finalizeOpen && selectedOutline && selectedContent && !hideLegacyFlow ? (
          <div className="p-4 overflow-y-auto">
            <FinalizePanel
              project={project}
              chapter={selectedOutline}
              content={selectedContent}
              onClose={() => setFinalizeOpen(false)}
              onCommit={(payload) => {
                onFinalizeChapter?.({
                  chapterId: selectedOutline.id,
                  chapterOrder: selectedOutline.order,
                  ...payload,
                });
                setFinalizeOpen(false);
              }}
            />
          </div>
        ) : selectedOutline ? (
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
                    ? `${wordCount.toLocaleString()} 字 · 目标 ${lengthRange.min}–${lengthRange.max}`
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
                  onClick={() =>
                    hideLegacyFlow && onWriteNext
                      ? onWriteNext()
                      : onRequestContract
                        ? onRequestContract(selectedOutline.id)
                        : onGenerateChapter(selectedOutline)
                  }
                >
                  {busy === `chapter:${selectedOutline.id}` ? (
                    <>
                      <span className="spinner" /> 生成中
                    </>
                  ) : selectedContent?.status === "error" ? (
                    "重试生成"
                  ) : selectedContent?.status === "done" ? (
                    "重新生成"
                  ) : hideLegacyFlow ? (
                    "写下一章"
                  ) : (
                    "生成本章"
                  )}
                </button>
                {allowsWholeBookGenerate(project) && onWriteNext ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy}
                    onClick={onWriteNext}
                  >
                    写下一章
                  </button>
                ) : null}
                {content.trim() ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy}
                    onClick={() => void runChapterHealth()}
                  >
                    {busy === "chapter_health" ? "体检中…" : "本章体检"}
                  </button>
                ) : null}
                {hideLegacyFlow && content.trim() ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!busy}
                      onClick={() => onRerunReview?.(selectedOutline.id)}
                    >
                      重跑审稿
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!!busy}
                      onClick={() => onRerunSettle?.(selectedOutline.id)}
                    >
                      重跑结算
                    </button>
                  </>
                ) : null}
                {content.trim() && selectedContent?.reviewState === "reviewed" ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      onUpdateChapterMeta(selectedOutline.id, {
                        reviewState: "draft",
                      })
                    }
                  >
                    标为未审
                  </button>
                ) : content.trim() && !hideLegacyFlow ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFinalizeOpen(true)}
                  >
                    定稿…
                  </button>
                ) : null}
                {content.trim() ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      onUpdateChapterMeta(selectedOutline.id, {
                        publishedAt: selectedContent?.publishedAt
                          ? undefined
                          : new Date().toISOString(),
                      })
                    }
                  >
                    {selectedContent?.publishedAt ? "取消发布" : "标为已发布"}
                  </button>
                ) : null}
              </div>

              {needsFill ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--warning)]">
                  <span>
                    未达 {lengthLabel} 下限（{lengthRange.min} 字）
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy}
                    onClick={() => void fillToLength()}
                  >
                    {busy === "continue" ? "补足中…" : "一键补足"}
                  </button>
                </div>
              ) : null}

              {selectedContent?.canonWarnings?.length ? (
                <div className="mt-2 rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
                  与锁定设定可能冲突：{selectedContent.canonWarnings.join("；")}
                </div>
              ) : null}

              {chapterHealth ? (
                <div className="mt-2 rounded-md border border-[var(--border-soft)] px-3 py-2 text-xs space-y-1">
                  <div>
                    篇幅：{chapterHealth.length.chars} 字（
                    {chapterHealth.length.min}–{chapterHealth.length.max}）
                    {chapterHealth.length.ok ? " · 达标" : " · 未达标"}
                  </div>
                  <div>
                    摘要：{chapterHealth.summary.present ? "已有" : "缺失"}
                  </div>
                  <div>
                    锁定设定：
                    {chapterHealth.canon.ok
                      ? "无冲突"
                      : chapterHealth.canon.violations.join("；")}
                  </div>
                  {chapterHealth.outline ? (
                    <div>
                      大纲对照 {chapterHealth.outline.score}/10
                      {chapterHealth.outline.missing?.length
                        ? ` · 未覆盖：${chapterHealth.outline.missing.join("、")}`
                        : ""}
                      {chapterHealth.outline.advice
                        ? ` · ${chapterHealth.outline.advice}`
                        : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-start gap-2 mt-2 text-xs text-[var(--text-muted)]">
                {selectedContent?.summaryFailed ? (
                  <span className="text-[var(--danger-text)]">
                    摘要生成失败，点击重试
                  </span>
                ) : editingSummary ? (
                  <div className="w-full space-y-2">
                    <textarea
                      rows={4}
                      className="w-full"
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          onUpdateChapterMeta(selectedOutline.id, {
                            summary: summaryDraft.trim(),
                            summaryFailed: false,
                          });
                          onHandEditSummary?.(
                            selectedOutline.id,
                            selectedOutline.order
                          );
                          setEditingSummary(false);
                        }}
                      >
                        保存摘要
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingSummary(false)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (selectedContent?.summary || "").trim() ? (
                  <button
                    type="button"
                    className="line-clamp-2 text-left border-0 bg-transparent p-0 cursor-pointer text-[var(--text-muted)]"
                    onClick={() => {
                      setSummaryDraft(selectedContent?.summary || "");
                      setEditingSummary(true);
                    }}
                    title="点击编辑摘要"
                  >
                    摘要：{selectedContent?.summary}
                  </button>
                ) : content.trim() ? (
                  <span>无摘要</span>
                ) : null}
                {content.trim() && !editingSummary ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy}
                    onClick={() => void regenerateSummary()}
                  >
                    {busy === "chapter_summary"
                      ? "生成摘要中…"
                      : selectedContent?.summary
                        ? "重新生成摘要"
                        : "生成摘要"}
                  </button>
                ) : null}
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
                      ? `${findIndexEffective + 1}/${findMatches.length}`
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
                  <CastPicker
                    characters={project.characters}
                    castIds={selectedOutline.castIds}
                    onChange={(ids) =>
                      onChapterCastChange(selectedOutline.id, ids)
                    }
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
                    {allowsWholeBookGenerate(project) ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!!busy || !selectedContent?.scenes?.length}
                        onClick={generateByScenes}
                      >
                        按场景生成
                      </button>
                    ) : null}
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
                  {rewriteMode === "expand" ? (
                    <select
                      className="!w-auto"
                      value={String(expandScale)}
                      onChange={(e) =>
                        setExpandScale(Number(e.target.value) as 1.5 | 2)
                      }
                      disabled={!!busy}
                    >
                      <option value="1.5">1.5×</option>
                      <option value="2">2×</option>
                    </select>
                  ) : null}
                  {rewriteMode === "custom" ? (
                    <input
                      className="!w-auto min-w-[8rem] flex-1"
                      value={rewriteInstruction}
                      onChange={(e) => setRewriteInstruction(e.target.value)}
                      placeholder="自定义改写要求，如：改成雨夜"
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
                    placeholder="续写方向（可空）"
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

            {renewal && selectedOutline ? (
              <BeatWorkbench
                project={project}
                outlineChapter={selectedOutline}
                chapter={selectedContent}
                busy={busy}
                onBusy={onBusy}
                onError={onError}
                onUpdateScenes={(scenes) =>
                  onUpdateChapterMeta(selectedOutline.id, { scenes })
                }
                onAppendContent={(piece, opts) => {
                  const base = selectedContent?.content || "";
                  const next = base
                    ? `${base.replace(/\s+$/, "")}\n\n${piece}`
                    : piece;
                  return persistContent(next, {
                    pushVersion: "beat",
                    forceCanon: opts?.forceCanon,
                  });
                }}
                onCommitDeltas={(deltas) =>
                  onCommitBeatDeltas?.(selectedOutline.id, deltas)
                }
              />
            ) : null}

            {blockedSave?.violations.length ? (
              <div className="px-4 py-2 text-xs text-[var(--danger-text)] border-t border-[var(--border-soft)]">
                <p className="mt-0 mb-2">{blockedSave.violations.join("；")}</p>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() =>
                    persistContent(blockedSave.content, { forceCanon: true })
                  }
                >
                  强制保存并警告
                </button>
              </div>
            ) : null}

            {selectedContent?.status === "generating" &&
            !localStreaming &&
            !busy?.startsWith("chapter") ? (
              <div className="empty flex-1 flex items-center justify-center gap-2 min-h-[50vh]">
                <span className="spinner" /> AI 正在撰写正文…
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex">
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
                      persistContent(e.target.value);
                    }}
                    readOnly={!!busy}
                    spellCheck={false}
                  />
                </div>
                {content.trim() &&
                selectedContent?.reviewState !== "reviewed" ? (
                  <ReviewSidebar
                    project={project}
                    chapter={selectedOutline}
                    content={content}
                    summary={selectedContent?.summary || ""}
                    voiceName={voiceName}
                    onVoiceName={setVoiceName}
                  />
                ) : null}
              </div>
            )}
            {selectedContent?.status === "error" ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--danger-text)] m-0 px-5 py-2 border-t border-[var(--border-soft)] shrink-0">
                <span className="flex-1 min-w-0">{selectedContent.error}</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!!busy}
                  onClick={() =>
                    onRequestContract
                      ? onRequestContract(selectedOutline.id)
                      : onGenerateChapter(selectedOutline)
                  }
                >
                  重试生成
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="还没选章节"
            description="从左侧点一章，或先生成大纲。"
            action={
              chapters[0] ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onSelect(chapters[0].id)}
                >
                  打开第一章
                </button>
              ) : undefined
            }
          />
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

function ChapterNavItem({
  ch,
  status,
  words,
  selected,
  touched,
  unreviewed,
  repaired,
  onSelect,
}: {
  ch: OutlineChapter;
  status: ChapterContent["status"];
  words: number;
  selected: boolean;
  touched?: string[];
  unreviewed?: boolean;
  repaired?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`w-full text-left px-2.5 py-2.5 rounded-lg border-0 cursor-pointer text-sm ${
          selected
            ? "bg-[var(--bg-hover)] text-[var(--text)]"
            : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg)]"
        }`}
        onClick={() => onSelect(ch.id)}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium truncate">
            {ch.order}. {ch.title}
          </span>
          <span className="inline-flex items-center gap-1 shrink-0">
            {repaired ? (
              <span className="text-[10px] text-[var(--warning)]" title="上游账已修">
                修
              </span>
            ) : null}
            {unreviewed ? (
              <span
                className="inline-block w-2 h-2 rounded-full bg-[var(--warning)]"
                title="未审"
              />
            ) : null}
            <StatusDot status={status} />
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 tabular-nums">
          {words ? `${words.toLocaleString()} 字` : "未写"}
        </div>
        {touched?.length ? (
          <div className="text-[10px] text-[var(--accent)] mt-0.5 truncate">
            本章触及：{touched.join("、")}
          </div>
        ) : null}
      </button>
    </li>
  );
}

function ReviewSidebar({
  project,
  chapter,
  content,
  summary,
  voiceName,
  onVoiceName,
}: {
  project: NovelProject;
  chapter: OutlineChapter;
  content: string;
  summary: string;
  voiceName: string;
  onVoiceName: (name: string) => void;
}) {
  const castIds = chapter.castIds || [];
  const cast = castIds.length
    ? project.characters.filter((c) => castIds.includes(c.id))
    : project.characters;
  const names = cast.map((c) => c.name).filter(Boolean);
  const who = voiceName || names[0] || "";
  const sample = cast.find((c) => c.name === who)?.speechStyle || "";
  const lines = extractCharacterDialogue(content, who);
  const contract = formatChapterContract({
    chapter,
    globalForbid: globalForbidList(project.premiseCard),
    ledger: project.characterStates,
    characters: project.characters,
  });
  const ledger = formatCharacterStateLedger(project.characterStates, names, 3);
  return (
    <aside className="w-[220px] shrink-0 border-l border-[var(--border-soft)] overflow-y-auto p-2 text-xs space-y-2">
      <div className="font-medium">审阅侧栏</div>
      <p className="text-[var(--text-muted)] m-0">
        三遍读：读者遍看正文；事实遍对契约；声音遍对样本。
      </p>
      <details open>
        <summary className="cursor-pointer">本章契约</summary>
        <pre className="whitespace-pre-wrap m-0 mt-1 text-[10px]">{contract}</pre>
      </details>
      <details open>
        <summary className="cursor-pointer">账本与声音样本</summary>
        <pre className="whitespace-pre-wrap m-0 mt-1 text-[10px]">
          {ledger || "（无账本）"}
        </pre>
        <p className="mt-1 mb-0">说话风格：{sample || "（未填）"}</p>
        <select
          className="mt-1"
          value={who}
          onChange={(e) => onVoiceName(e.target.value)}
        >
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {lines.length ? (
          <ul className="mt-1 mb-0 pl-4">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--text-muted)] mt-1 mb-0">
            抽本章对话：正文里还没有带引号的台词。
          </p>
        )}
      </details>
      <details open>
        <summary className="cursor-pointer">本章摘要</summary>
        <p className="whitespace-pre-wrap mt-1 mb-0">{summary || "（无）"}</p>
      </details>
    </aside>
  );
}

function StatusDot({ status }: { status: ChapterContent["status"] }) {
  const map: Record<ChapterContent["status"], string> = {
    idle: "bg-[var(--border)]",
    generating: "bg-[var(--warning)] animate-pulse",
    done: "bg-[var(--success)]",
    error: "bg-[var(--danger)]",
  };
  const titles: Record<ChapterContent["status"], string> = {
    idle: "未生成",
    generating: "生成中",
    done: "已完成",
    error: "失败",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status]}`}
      title={titles[status]}
    />
  );
}

// re-export helper for page if needed
export { pushChapterVersion };
