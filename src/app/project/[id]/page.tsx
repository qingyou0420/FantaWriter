"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackgroundPanel } from "@/components/BackgroundPanel";
import { DailyStatusBar } from "@/components/DailyStatusBar";
import { PremisePanel } from "@/components/PremisePanel";
import { VolumeCloseWizard } from "@/components/VolumeCloseWizard";
import { BookJobBar } from "@/components/BookJobBar";
import { ChaptersReader } from "@/components/ChaptersReader";
import { CharactersPanel } from "@/components/CharactersPanel";
import { PlotThreadsPanel } from "@/components/PlotThreadsPanel";
import { OnboardingCard, dismissOnboarding, isOnboardingDismissed, shouldShowOnboarding } from "@/components/OnboardingCard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TagsPanel } from "@/components/TagsPanel";
import { ToolsPanel } from "@/components/ToolsPanel";
import { StyleLearnPanel } from "@/components/StyleLearnPanel";
import { AppSettingsMenu } from "@/components/AppSettingsMenu";
import { StudioShell } from "@/components/studio/StudioShell";
import { OverviewWorkspace } from "@/components/studio/OverviewWorkspace";
import { OutlineWorkspace } from "@/components/studio/OutlineWorkspace";
import { ReviewWorkspace } from "@/components/studio/ReviewWorkspace";
import { LibraryWorkspace } from "@/components/studio/LibraryWorkspace";
import { SessionsWorkspace } from "@/components/studio/SessionsWorkspace";
import { ToolsWorkspace } from "@/components/studio/ToolsWorkspace";
import { AssistantRail } from "@/components/studio/AssistantRail";
import { DiffConfirmGate } from "@/components/studio/DiffConfirmGate";
import { WriteNextDialog } from "@/components/studio/WriteNextDialog";
import { FocusPanel } from "@/components/studio/FocusPanel";
import { LorePanel } from "@/components/LorePanel";
import { OriginalPanel } from "@/components/OriginalPanel";
import { attachOriginalContext, mergeCanonFacts } from "@/lib/original";
import { allowsWholeBookGenerate, evaluateRenewalSave, wholeBookGenerateBlockedReason } from "@/lib/renewal";
import { mapSkeletonToProject } from "@/lib/skeleton";
import {
  applyBeatDeltasToProject,
  type BeatCommitDeltas,
} from "@/lib/beat-contract";
import {
  chapterBelowMin,
  continueLengthRequirement,
  countChapterChars,
} from "@/lib/length";
import {
  appendVolumeChapters,
  mergeVolumeChapters,
  previousVolumeEnding,
  volumeHasWrittenChapters,
  volumeNeedsSummaryPrompt,
} from "@/lib/volumes";
import { chapterAssembleExtras } from "@/lib/chapter-contract";
import {
  formatOpenThreadsForOutline,
  injectableEndingDirection,
  injectablePremise,
  readerKnownOpenThreadTitles,
} from "@/lib/author-secrets";
import {
  defaultOpeningWorkspace,
  EMPTY_OUTLINE_WRITE_HINT,
  findRecommendedOutlineChapter,
  findWriteNextChapter,
  listUnreviewedChapters,
  pushAccountRepairMark,
  resolveWriteThisChapter,
} from "@/lib/daily-flow";
import { projectAfterFinalize } from "@/lib/finalize-chapter";
import {
  formatCharacterStateLedger,
  isPlotThreadOverdue,
  chapterOrderById,
  maxWrittenOrder,
} from "@/lib/memory-pack";
import { useProjectStore } from "@/hooks/useProjectStore";
import { loadAppPrefs } from "@/lib/theme";
import { scheduleDeferredWork } from "@/lib/schedule-idle";
import {
  downloadFullBackup,
  readProjectTab,
  writeProjectTab,
  saveStyleLibraryFor,
} from "@/lib/storage";
import {
  buildConsistencyRows,
  toConsistencyReport,
} from "@/lib/consistency";
import {
  formatPlotThreadsForPrompt,
  postGenerate,
  streamGenerate,
  type GenerateRequest,
} from "@/lib/api";
import {
  createBookJob,
  finalizeBookJobStatus,
  nextPendingItem,
  normalizeStaleJob,
  patchBookJobItem,
  prepareJobForResume,
  prepareRetryErrors,
  shouldPauseAfterMaxChapters,
  type BookJob,
} from "@/lib/book-job";
import {
  pushChapterVersion,
  type ChapterContent,
  type LearnedStyle,
  type Outline,
  type OutlineChapter,
} from "@/lib/types";
import {
  resolveStudioWorkspace,
  type LibrarySection,
  type StudioWorkspace,
  type ToolsSection,
} from "@/lib/project-tabs";
import {
  applyCanonProposal,
  createCanonConfirmation,
  enqueueCanonDraft,
  markAuthorCanonEdit,
  pendingCanonProposals,
  proposalFromBackground,
  proposalFromCharacters,
  proposalFromOutline,
  proposalFromPolishedChapter,
  rejectCanonProposal,
  type CanonProposal,
} from "@/lib/canon-gate";
import {
  applySettleToProject,
  beginWriteRun,
  clearWriteLock,
  commitWriteRun,
  keepPartialDraft,
  latestUndoableWriteRun,
  markSettlePending,
  precheckWriteNext,
  recoverStaleWriteRuns,
  rollbackWriteRun,
  setWriteRunPhase,
  undoCommittedWriteRun,
} from "@/lib/write-pipeline";
import { syncOutlineTree } from "@/lib/outline-tree";
import { chapterPromptContext } from "@/lib/canonical-packet";
import { reviewStateAfterIssues } from "@/lib/review-registry";
import {
  addBlankOutlineChapter,
  addOutlineVolume,
  patchOutlineChapter,
  patchOutlineVolume,
  removeOutlineChapter,
} from "@/lib/outline-edit";
import { chapterGoalText } from "@/lib/chapter-contract";
import { globalForbidList } from "@/lib/author-secrets";
import { formatLoreBlock, selectLoreForPrompt } from "@/lib/lore";
import { appendStudioSessionEvent } from "@/lib/studio-session";
import { PLANNER_AGENT_LABEL, WRITER_AGENT_LABEL } from "@/lib/brand";
import { createThrottledTextSink } from "@/lib/stream-throttle";
import { isTransientAiError, sleep, splitErrorForDisplay } from "@/lib/user-error";
import { parseTouchedThreads } from "@/lib/prompts";

const LIBRARY_FROM_LEGACY: Record<string, LibrarySection> = {
  premise: "intent",
  characters: "characters",
  background: "foundation",
  lore: "world",
  plot: "threads",
};

const TOOLS_FROM_LEGACY: Record<string, ToolsSection> = {
  settings: "settings",
  original: "migrate",
  tags: "tags",
  tools: "tools",
  progress: "tools",
};



export default function ProjectPage() {
  const params = useParams();
  const id = String(params.id);
  const {
    project,
    update,
    saveHint,
    saveError,
    storageWarning: _storageWarning,
    tagLibrary,
    styleLibrary,
    ready,
    getLive,
  } = useProjectStore(id);

  const [workspace, setWorkspace] = useState<StudioWorkspace>(() =>
    resolveStudioWorkspace(readProjectTab(id))
  );
  const [librarySection, setLibrarySection] = useState<LibrarySection>("intent");
  const [toolsSection, setToolsSection] = useState<ToolsSection>("tools");
  const [pendingProposal, setPendingProposal] = useState<CanonProposal | null>(
    null
  );
  const [writeDialog, setWriteDialog] = useState<{
    chapter: OutlineChapter;
    goal: string;
    hook: string;
    skipReview: boolean;
  } | null>(null);
  const [stalePrompt, setStalePrompt] = useState<{
    runId: string;
    chapterId: string;
  } | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [assistantSelection, setAssistantSelection] = useState("");
  const [focusOffset, setFocusOffset] = useState<number | null>(null);
  const [modelSummary, setModelSummary] = useState("模型设置");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [keyPrefix, setKeyPrefix] = useState("");
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorDiagnostic, setErrorDiagnostic] = useState("");
  const [errorRetry, setErrorRetry] = useState<null | (() => void)>(null);
  const [info, setInfo] = useState("");
  const [guideOpen, setGuideOpen] = useState(
    () => !isOnboardingDismissed(id)
  );
  const [volumeSummaryDraft, setVolumeSummaryDraft] = useState<{
    volumeId: string;
    text: string;
  } | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null
  );
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);
  const outlineEnterRef = useRef(false);
  const [includeEndingDirection, setIncludeEndingDirection] = useState(false);
  const [volumeWizardId, setVolumeWizardId] = useState<string | null>(null);
  const [characterEditorRequest, setCharacterEditorRequest] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [streamPreview, setStreamPreview] = useState("");
  /** 全书队列：暂停/跳过标志 */
  const jobControlRef = useRef<{
    pause: boolean;
    skip: boolean;
    running: boolean;
  }>({ pause: false, skip: false, running: false });
  const streamPreviewRef = useRef("");
  const streamSinkRef = useRef(
    createThrottledTextSink((full) => {
      streamPreviewRef.current = full;
      setStreamPreview(full);
    })
  );
  const pendingSummaryRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    streamPreviewRef.current = streamPreview;
  }, [streamPreview]);

  useEffect(() => {
    if (!ready || !project) return;
    const stored = readProjectTab(id);
    const next = defaultOpeningWorkspace(stored, project);
    const firstUnreviewed = listUnreviewedChapters(project)[0];
    const stale = recoverStaleWriteRuns(project).stale[0];
    queueMicrotask(() => {
      setWorkspace(next);
      if (stored && LIBRARY_FROM_LEGACY[stored]) {
        setLibrarySection(LIBRARY_FROM_LEGACY[stored]);
      }
      if (stored && TOOLS_FROM_LEGACY[stored]) {
        setToolsSection(TOOLS_FROM_LEGACY[stored]);
      }
      if (firstUnreviewed) setSelectedChapterId(firstUnreviewed.id);
      if (stale) {
        setStalePrompt({ runId: stale.id, chapterId: stale.chapterId });
      }
    });
    // 只在打开项目时归位一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, project?.id]);

  function goWorkspace(next: StudioWorkspace) {
    setWorkspace(next);
    try {
      writeProjectTab(id, next);
    } catch {
      /* ignore */
    }
  }

  function goTab(next: string) {
    const ws = resolveStudioWorkspace(next);
    goWorkspace(ws);
    if (LIBRARY_FROM_LEGACY[next]) setLibrarySection(LIBRARY_FROM_LEGACY[next]);
    if (TOOLS_FROM_LEGACY[next]) setToolsSection(TOOLS_FROM_LEGACY[next]);
  }

  // 快捷键：Ctrl+1/2/3 阶段；Ctrl+S 提示已自动保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "s") {
        e.preventDefault();
        setInfo("已自动保存（编辑后会防抖写入）");
        return;
      }
      if (typing) return;
      if (e.key === "1") {
        e.preventDefault();
        goWorkspace("overview");
      } else if (e.key === "2") {
        e.preventDefault();
        goWorkspace("manuscript");
      } else if (e.key === "3") {
        e.preventDefault();
        goWorkspace("review");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, id]);

  useEffect(() => {
    const stop = scheduleDeferredWork(() => {
      void fetch("/api/config")
        .then((r) => r.json())
        .then((data) => {
          const main = data.env?.model || "主力档";
          const fine = data.env?.fineModel ? " · 精写已配" : "";
          setModelSummary(`${main}${fine}`);
          setHasApiKey(Boolean(data.env?.hasKey));
          setKeyPrefix(String(data.env?.keyPrefix || ""));
        })
        .catch(() => undefined);
    }, 0);
    return stop;
  }, []);

  useEffect(() => {
    if (!ready || !project?.bookJob) return;
    const job = project.bookJob as BookJob;
    if (job.status === "running" && !jobControlRef.current.running) {
      setBookJob(normalizeStaleJob(job));
    }
    // 只在加载完成时归位一次，避免把正在跑的队列打断
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, project?.id]);

  const pendingDraftKey = (project?.canonDrafts || [])
    .filter((d) => d.status === "pending")
    .map((d) => d.id)
    .join(",");
  useEffect(() => {
    if (!project || pendingProposal) return;
    const next = pendingCanonProposals(project)[0];
    if (next) setPendingProposal(next);
    // 只在项目切换或待确认条目集合变化时重开闸，避免每个键入重置弹窗
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, pendingDraftKey, pendingProposal]);

  // 大纲首章：选中章无效或不存在时回落到第一项（渲染期派生，避免 effect setState）
  const outlineFirstId = project?.outline?.chapters[0]?.id ?? null;
  const effectiveSelectedId =
    selectedChapterId &&
    project?.outline?.chapters.some((c) => c.id === selectedChapterId)
      ? selectedChapterId
      : outlineFirstId;

  useEffect(() => {
    if (!project) return;
    if (workspace !== "outline") {
      outlineEnterRef.current = false;
      return;
    }
    if (volumeWizardId) {
      setSelectedVolumeId(volumeWizardId);
      outlineEnterRef.current = true;
      return;
    }
    if (outlineEnterRef.current) return;
    outlineEnterRef.current = true;
    const rec = findRecommendedOutlineChapter(project);
    if (rec) {
      setSelectedChapterId(rec.id);
      setSelectedVolumeId(null);
    }
  }, [workspace, project, volumeWizardId]);

  const setBookJob = useCallback(
    (job: BookJob | null | ((prev: BookJob | null | undefined) => BookJob | null)) => {
      update((p) => {
        const prev = p.bookJob as BookJob | null | undefined;
        const next = typeof job === "function" ? job(prev) : job;
        return { ...p, bookJob: next };
      });
    },
    [update]
  );

  function applyLearnedStyle(style: LearnedStyle) {
    update((p) => {
      if (style.writingBoard && style.writingBoard !== p.writingBoard) {
        return p;
      }
      return {
        ...p,
        settings: {
          ...p.settings,
          writingStyle: "learned",
          learnedStyleId: style.id,
          learnedStyleGuide: style.styleGuide,
          learnedStyleName: style.name,
          learnedStyleFingerprints: style.fingerprints || [],
        },
      };
    });
  }

  function clearLearnedStyle() {
    update((p) => ({
      ...p,
      settings: {
        ...p.settings,
        writingStyle:
          p.settings.writingStyle === "learned"
            ? "literary"
            : p.settings.writingStyle,
        learnedStyleId: "",
        learnedStyleGuide: "",
        learnedStyleName: "",
        learnedStyleFingerprints: [],
      },
    }));
  }

  function reportError(err: unknown, retry?: () => void) {
    const split = splitErrorForDisplay(err);
    setError(split.message);
    setErrorDiagnostic(split.diagnostic || "");
    setErrorRetry(retry ? () => retry : null);
  }

  async function generateOutline() {
    if (!project) return;
    if (project.outline?.chapters.length) {
      const hasBody = project.chapters.some((c) => c.content?.trim());
      const msg = hasBody
        ? "将替换全书大纲并清空生成队列，已写正文保留但可能与新大纲脱钩。确定继续？"
        : "将替换现有大纲并清空生成队列。确定继续？";
      if (!confirm(msg)) return;
    }
    setError("");
    setErrorDiagnostic("");
    setBusy("outline");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          attachOriginalContext(project, {
            mode: "outline",
            writingBoard: project.writingBoard,
            characters: project.characters,
            background: project.background,
            settings: project.settings,
            projectTags: project.tags || [],
            premise: injectablePremise(project.premiseCard, project.outline),
            includeEndingDirection,
            endingDirection: injectableEndingDirection(
              includeEndingDirection,
              project.premiseCard
            ),
          })
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      if (data.parseError) setError(data.parseError);
      const outline = data.outline as Outline;
      outline.chapters = outline.chapters.map((ch) => ({
        ...ch,
        tags: Array.isArray(ch.tags) ? ch.tags : [],
      }));
      const proposal = proposalFromOutline({
        kind: "outline",
        before: project.outline,
        after: outline,
        summary: `全书大纲：${outline.chapters.length} 章`,
      });
      update((p) =>
        appendStudioSessionEvent(
          enqueueCanonDraft(p, proposal),
          undefined,
          { kind: "confirm", title: "织卷提交全书大纲，等待确认" },
          { kind: "planner", title: PLANNER_AGENT_LABEL }
        )
      );
      setPendingProposal(proposal);
      if (outline.chapters[0]) setSelectedChapterId(outline.chapters[0].id);
      goWorkspace("outline");
    } catch (e) {
      reportError(e, () => void generateOutline());
    } finally {
      setBusy(null);
    }
  }

  async function generateVolumeOutline(volumeId: string, chapterCount: number) {
    if (!project) return;
    const volume = (project.volumes || []).find((v) => v.id === volumeId);
    if (!volume) return;
    const live = getLive() || project;
    if (volumeHasWrittenChapters(live, volumeId)) {
      if (
        !confirm(
          "本卷已有章节正文。重新生成本卷大纲会替换这些章，已写正文将丢失。确定继续？"
        )
      ) {
        return;
      }
    }
    setError("");
    setBusy(`outline_volume:${volumeId}`);
    try {
      const fresh = getLive() || project;
      const res = await postGenerate(
        attachOriginalContext(fresh, {
          mode: "outline_volume",
          writingBoard: fresh.writingBoard,
          characters: fresh.characters,
          background: fresh.background,
          settings: fresh.settings,
          volume,
          volumeId,
          previousEnding: previousVolumeEnding(fresh, volumeId),
          chapterCount,
          projectTags: fresh.tags || [],
        })
      );
      if (res.parseError) setError(String(res.parseError));
      const incoming = res.outline as Outline;
      incoming.chapters = (incoming.chapters || []).map((ch) => ({
        ...ch,
        tags: Array.isArray(ch.tags) ? ch.tags : [],
        volumeId,
      }));
      const live = getLive() || project;
      const nextChapters = mergeVolumeChapters(
        live.outline?.chapters || [],
        incoming.chapters,
        volumeId,
        live.volumes
      );
      const outline: Outline = {
        premise: live.outline?.premise || incoming.premise || "",
        endingNote: live.outline?.endingNote || incoming.endingNote || "",
        chapters: nextChapters,
        raw: incoming.raw,
      };
      const proposal = proposalFromOutline({
        kind: "outline_volume",
        before: live.outline,
        after: outline,
        summary: `本卷大纲：${incoming.chapters.length} 章`,
      });
      update((p) => enqueueCanonDraft(p, proposal));
      setPendingProposal(proposal);
      goWorkspace("outline");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function generateNextChapters(volumeId: string, chapterCount: number) {
    if (!project) return;
    if (!allowsWholeBookGenerate(project)) {
      setError(wholeBookGenerateBlockedReason());
      return;
    }
    const volume = (project.volumes || []).find((v) => v.id === volumeId);
    if (!volume) return;
    setError("");
    setBusy(`outline_next:${volumeId}`);
    try {
      const fresh = getLive() || project;
      const orderById = chapterOrderById(fresh.outline?.chapters);
      const writtenMax = maxWrittenOrder(fresh);
      const recent = [...(fresh.outline?.chapters || [])]
        .filter((c) => (c.volumeId || fresh.volumes?.[0]?.id) === volumeId)
        .sort((a, b) => a.order - b.order)
        .slice(-10)
        .map((ch) => {
          const row = fresh.chapters.find((c) => c.chapterId === ch.id);
          return {
            order: ch.order,
            title: ch.title,
            summary: row?.summary || ch.summary || "",
          };
        });
      if (
        !(volume.arcGoal || "").trim() ||
        !(volume.exitState || "").trim()
      ) {
        const fill = confirm(
          "开卷前请先重定本卷弧线目标与出卷局面。现在去大纲页填写本卷？\n点「取消」仍继续续排。"
        );
        if (fill) {
          setSelectedVolumeId(volumeId);
          goWorkspace("outline");
          setBusy(null);
          return;
        }
      }
      const openThreads = formatOpenThreadsForOutline(
        fresh.plotThreads,
        (t) =>
          isPlotThreadOverdue(t, orderById, writtenMax)
            ? "（建议在本批回收）"
            : ""
      );
      const names = (fresh.characters || []).map((c) => c.name).filter(Boolean);
      const res = await postGenerate(
        attachOriginalContext(fresh, {
          mode: "outline_next",
          writingBoard: fresh.writingBoard,
          characters: fresh.characters,
          background: fresh.background,
          settings: fresh.settings,
          volume,
          volumeId,
          chapterCount,
          recentSummaries: recent,
          openThreads,
          characterStates: formatCharacterStateLedger(
            fresh.characterStates,
            names,
            3
          ),
          projectTags: fresh.tags || [],
          premise: injectablePremise(fresh.premiseCard, fresh.outline),
          includeEndingDirection,
          endingDirection: injectableEndingDirection(
            includeEndingDirection,
            fresh.premiseCard
          ),
        })
      );
      if (res.parseError) setError(String(res.parseError));
      const incoming = res.outline as Outline;
      incoming.chapters = (incoming.chapters || []).map((ch) => ({
        ...ch,
        tags: Array.isArray(ch.tags) ? ch.tags : [],
        volumeId,
      }));
      const liveAfter = getLive() || fresh;
      const nextChapters = appendVolumeChapters(
        liveAfter.outline?.chapters || [],
        incoming.chapters,
        volumeId,
        liveAfter.volumes
      );
      const outline: Outline = {
        premise: liveAfter.outline?.premise || incoming.premise || "",
        endingNote: liveAfter.outline?.endingNote || incoming.endingNote || "",
        chapters: nextChapters,
        raw: incoming.raw,
      };
      const proposal = proposalFromOutline({
        kind: "outline_next",
        before: liveAfter.outline,
        after: outline,
        summary: `续排 ${incoming.chapters.length} 章`,
      });
      update((p) => enqueueCanonDraft(p, proposal));
      setPendingProposal(proposal);
      goWorkspace("outline");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function cancelGeneration() {
    jobControlRef.current.pause = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(null);
    setStreamPreview("");
  }

  /**
   * 生成本章正文。
   * @param opts.fromJob 是否由全书队列驱动（不弹确认、不打断队列 busy）
   */
  async function generateChapter(
    chapter: OutlineChapter,
    force = false,
    opts?: { fromJob?: boolean; skipAutoSummary?: boolean }
  ): Promise<"done" | "error" | "cancelled" | "skipped"> {
    const fromJob = opts?.fromJob;
    const liveProject = getLive();
    if (!liveProject?.outline) return "error";

    const existing = liveProject.chapters.find(
      (c) => c.chapterId === chapter.id
    );
    if (!force && !fromJob && existing?.status === "done" && existing.content) {
      if (!confirm("该章已有正文，确定覆盖重新生成？")) return "skipped";
    }

    setError("");
    if (!fromJob) setBusy(`chapter:${chapter.id}`);
    setSelectedChapterId(chapter.id);
    setStreamPreview("");
    if (!fromJob) goWorkspace("manuscript");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    update((p) => {
      const chapters = [...p.chapters];
      const idx = chapters.findIndex((c) => c.chapterId === chapter.id);
      let base: ChapterContent =
        idx >= 0
          ? chapters[idx]
          : {
              chapterId: chapter.id,
              title: chapter.title,
              content: "",
              status: "idle",
              updatedAt: new Date().toISOString(),
            };
      if (base.content?.trim()) {
        base = pushChapterVersion(base, "before-regenerate");
      }
      const row: ChapterContent = {
        ...base,
        title: chapter.title,
        status: "generating",
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) chapters[idx] = row;
      else chapters.push(row);
      return { ...p, chapters };
    });

    try {
      const fresh = getLive() || liveProject;
      const liveChapter =
        fresh.outline?.chapters.find((c) => c.id === chapter.id) || chapter;
      const prior = chapterPromptContext(fresh, liveChapter.order);
      const extras = chapterAssembleExtras(fresh, liveChapter);

      const buildBody = (
        mode: "chapter" | "continue",
        extra?: { existingText?: string; instruction?: string }
      ): GenerateRequest =>
        attachOriginalContext(fresh, {
          mode,
          writingBoard: fresh.writingBoard,
          characters: fresh.characters,
          background: fresh.background,
          settings: fresh.settings,
          outline: fresh.outline,
          chapter: liveChapter,
          previousChapterSnippet: prior.previousChapterSnippet,
          previousSummaries: prior.previousSummaries,
          previousSummary: prior.previousSummary,
          characterStateCard: prior.characterStateCard,
          priorBlock: prior.priorBlock,
          plotThreads:
            prior.plotThreads ||
            formatPlotThreadsForPrompt(fresh.plotThreads),
          lore: prior.lore,
          loreEntries: fresh.lore,
          projectTags: fresh.tags || [],
          volumes: fresh.volumes,
          existingText: extra?.existingText,
          instruction: extra?.instruction,
          ...extras,
        });

      let text = await streamGenerate(buildBody("chapter"), {
        signal: ac.signal,
        onDelta: (_d, full) => streamSinkRef.current.push(full),
      });

      if (chapterBelowMin(text, fresh.settings.length) && !ac.signal.aborted) {
        try {
          const extra = await streamGenerate(
            buildBody("continue", {
              existingText: text,
              instruction: continueLengthRequirement(
                fresh.settings,
                countChapterChars(text)
              ),
            }),
            {
              signal: ac.signal,
              onDelta: (_d, full) => streamSinkRef.current.push(text + full),
            }
          );
          text = text + extra;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") throw e;
        }
      }

      const saveVerdict = evaluateRenewalSave(text, {
        original: fresh.original,
        canon: fresh.canon,
      });
      if (!saveVerdict.allowed) {
        update((p) => {
          const chapters = [...p.chapters];
          const idx = chapters.findIndex((c) => c.chapterId === liveChapter.id);
          if (idx < 0) return p;
          chapters[idx] = {
            ...chapters[idx],
            status: "error",
            error: `与锁定设定冲突，正文未保存：${saveVerdict.violations.join("；")}`,
            canonWarnings: saveVerdict.violations,
            updatedAt: new Date().toISOString(),
          };
          return { ...p, chapters };
        });
        setError(
          `与锁定设定冲突，正文未保存。请改稿或到正文页强制保存并警告。${saveVerdict.violations.join("；")}`
        );
        if (!fromJob) {
          setBusy(null);
          abortRef.current = null;
        }
        return "error";
      }
      const canonWarnings = saveVerdict.violations;

      if (opts?.skipAutoSummary) {
        pendingSummaryRef.current = null;
      } else {
        const openThreads = readerKnownOpenThreadTitles(fresh.plotThreads);
        const summaryPromise = postGenerate({
          mode: "chapter_summary",
          writingBoard: fresh.writingBoard,
          content: text,
          title: liveChapter.title,
          openThreads,
          settings: fresh.settings,
        })
          .then((sumRes) => {
            const raw = String(sumRes.summary || "");
            const touched = Array.isArray(sumRes.touchedThreads)
              ? (sumRes.touchedThreads as string[])
              : parseTouchedThreads(raw);
            const deltas = Array.isArray(sumRes.characterStates)
              ? sumRes.characterStates
              : [];
            update((p) => {
              const chapters = [...p.chapters];
              const idx = chapters.findIndex(
                (c) => c.chapterId === liveChapter.id
              );
              if (idx < 0) return p;
              chapters[idx] = {
                ...chapters[idx],
                summary: raw,
                touchedThreads: touched,
                summaryFailed: false,
                pendingStateDeltas: deltas,
              };
              return {
                ...p,
                chapters,
              };
            });
          })
          .catch(() => {
            update((p) => {
              const chapters = [...p.chapters];
              const idx = chapters.findIndex(
                (c) => c.chapterId === liveChapter.id
              );
              if (idx < 0) return p;
              chapters[idx] = {
                ...chapters[idx],
                summaryFailed: true,
              };
              return { ...p, chapters };
            });
          });
        pendingSummaryRef.current = summaryPromise;
      }

      update((p) => {
        const chapters = [...p.chapters];
        const idx = chapters.findIndex((c) => c.chapterId === liveChapter.id);
        const prev = idx >= 0 ? chapters[idx] : null;
        const row: ChapterContent = {
          chapterId: liveChapter.id,
          title: liveChapter.title,
          content: text,
          status: "done",
          updatedAt: new Date().toISOString(),
          versions: prev?.versions,
          scenes: prev?.scenes,
          summary: prev?.summary,
          canonWarnings: canonWarnings.length ? canonWarnings : undefined,
          reviewState: "draft",
        };
        if (idx >= 0) chapters[idx] = row;
        else chapters.push(row);
        return { ...p, chapters };
      });
      streamSinkRef.current.flush();
      setStreamPreview("");
      if (!fromJob) {
        setBusy(null);
        abortRef.current = null;
      }
      return "done";
    } catch (e) {
      const partial = streamPreviewRef.current;
      if (e instanceof Error && e.name === "AbortError") {
        const wasSkip = jobControlRef.current.skip;
        const wasPause = jobControlRef.current.pause;
        setError(wasSkip ? "已跳过本章" : wasPause ? "已暂停生成" : "已取消生成");
        update((p) => {
          const chapters = [...p.chapters];
          const idx = chapters.findIndex((c) => c.chapterId === chapter.id);
          if (idx >= 0) {
            chapters[idx] = {
              ...chapters[idx],
              content: partial || chapters[idx].content,
              status: partial
                ? "done"
                : chapters[idx].content
                  ? "done"
                  : "idle",
              updatedAt: new Date().toISOString(),
            };
          }
          return { ...p, chapters };
        });
        setStreamPreview("");
        if (!fromJob) {
          setBusy(null);
          abortRef.current = null;
        }
        return wasSkip ? "skipped" : "cancelled";
      }
      const msg = e instanceof Error ? e.message : String(e);
      reportError(e, () => void generateChapter(chapter));
      update((p) => {
        const chapters = [...p.chapters];
        const idx = chapters.findIndex((c) => c.chapterId === chapter.id);
        if (idx >= 0) {
          chapters[idx] = {
            ...chapters[idx],
            content: partial || chapters[idx].content,
            status: "error",
            error: msg,
            updatedAt: new Date().toISOString(),
          };
        }
        return { ...p, chapters };
      });
      // 失败章也把 partial 记入 job
      if (fromJob && partial) {
        setBookJob((j) =>
          j
            ? patchBookJobItem(j, chapter.id, {
                status: "error",
                error: msg,
                partialContent: partial,
              })
            : j ?? null
        );
      }
      setStreamPreview("");
      if (!fromJob) {
        setBusy(null);
        abortRef.current = null;
      }
      return "error";
    }
  }

  /** 跑全书队列：串行 pending 章，支持暂停/跳过/续跑 */
  async function runBookJob(seed?: BookJob) {
    if (jobControlRef.current.running) return;
    jobControlRef.current = { pause: false, skip: false, running: true };

    let job: BookJob | null =
      seed ||
      (getLive()?.bookJob as BookJob | null) ||
      null;
    if (!job) {
      jobControlRef.current.running = false;
      return;
    }

    goWorkspace("manuscript");
    setError("");
    let completedThisRun = 0;

    try {
      while (true) {
        if (jobControlRef.current.pause) {
          job = {
            ...finalizeBookJobStatus(job),
            status: "paused",
            currentChapterId: null,
          };
          setBookJob(job);
          break;
        }

        const item = nextPendingItem(job);
        if (!item) {
          job = finalizeBookJobStatus({
            ...job,
            currentChapterId: null,
          });
          setBookJob(job);
          // 全书队列跑完：可选自动一致性检查
          const finished = job;
          if (finished?.status === "done") {
            const live = getLive();
            if (live && finished.volumeId && volumeNeedsSummaryPrompt(live, finished.volumeId)) {
              const vol = (live.volumes || []).find((v) => v.id === finished.volumeId);
              if (vol) {
                setVolumeWizardId(vol.id);
                goWorkspace("outline");
              }
            } else if (live) {
              for (const vol of live.volumes || []) {
                if (volumeNeedsSummaryPrompt(live, vol.id)) {
                  setVolumeWizardId(vol.id);
                  goWorkspace("outline");
                  break;
                }
              }
            }
            void maybeAutoConsistency();
          }
          break;
        }

        job = {
          ...patchBookJobItem(job, item.chapterId, {
            status: "running",
            error: undefined,
          }),
          status: "running",
          currentChapterId: item.chapterId,
        };
        setBookJob(job);
        setBusy(`chapter:${item.chapterId}`);
        setSelectedChapterId(item.chapterId);

        const outlineCh =
          getLive()?.outline?.chapters.find((c) => c.id === item.chapterId) ||
          ({
            id: item.chapterId,
            order: item.order,
            title: item.title,
            summary: "",
            keyPoints: "",
            intensityNote: "",
            tags: [],
          } as OutlineChapter);

        jobControlRef.current.skip = false;
        let result = await runWritePipeline(outlineCh, {
          fromJob: true,
          force: true,
        });
        if (result === "error") {
          const failMsg =
            getLive()?.chapters.find((c) => c.chapterId === item.chapterId)
              ?.error || "";
          if (isTransientAiError(failMsg)) {
            await sleep(4000);
            if (!jobControlRef.current.pause && !jobControlRef.current.skip) {
              result = await runWritePipeline(outlineCh, {
                fromJob: true,
                force: true,
              });
            }
          }
        }

        // re-read job from control flags
        if (jobControlRef.current.skip) {
          job = patchBookJobItem(job, item.chapterId, {
            status: "skipped",
            error: undefined,
          });
          setBookJob(job);
          continue;
        }

        if (result === "cancelled" || jobControlRef.current.pause) {
          const partial = streamPreviewRef.current;
          job = {
            ...patchBookJobItem(job, item.chapterId, {
              status: "pending",
              partialContent: partial || undefined,
            }),
            status: "paused",
            currentChapterId: null,
          };
          setBookJob(job);
          break;
        }

        if (result === "done") {
          pendingSummaryRef.current = null;
          job = patchBookJobItem(job, item.chapterId, {
            status: "done",
            error: undefined,
            partialContent: undefined,
          });
          completedThisRun += 1;
          if (shouldPauseAfterMaxChapters(job, completedThisRun) && nextPendingItem(job)) {
            job = {
              ...finalizeBookJobStatus(job),
              status: "paused",
              currentChapterId: null,
            };
            setBookJob(job);
            setInfo(`已完成 ${job.maxChapters} 章，续跑继续`);
            break;
          }
          setBookJob(job);
          continue;
        }

        if (result === "skipped") {
          job = patchBookJobItem(job, item.chapterId, { status: "skipped" });
          setBookJob(job);
          continue;
        }

        // error — stop queue so user can decide
        job = {
          ...patchBookJobItem(job, item.chapterId, {
            status: "error",
            error: getLive()?.chapters.find((c) => c.chapterId === item.chapterId)
              ?.error || "生成失败",
            partialContent: streamPreviewRef.current || undefined,
          }),
          status: "error",
          currentChapterId: null,
        };
        setBookJob(job);
        break;
      }
    } finally {
      jobControlRef.current.running = false;
      setBusy(null);
      abortRef.current = null;
      setStreamPreview("");
    }
  }

  function requestWriteNext() {
    if (!project) return;
    const live = getLive() || project;
    const next = findWriteNextChapter(live, effectiveSelectedId);
    if (!next) {
      setError(EMPTY_OUTLINE_WRITE_HINT);
      goWorkspace("outline");
      return;
    }
    setSelectedChapterId(next.id);
    setWriteDialog({
      chapter: next,
      goal: chapterGoalText(next),
      hook: next.hook || "",
      skipReview: false,
    });
  }

  function requestWriteThisChapter(chapterId: string) {
    if (!project) return;
    const live = getLive() || project;
    const chapter = resolveWriteThisChapter(live, chapterId);
    if (!chapter) {
      setError(EMPTY_OUTLINE_WRITE_HINT);
      goWorkspace("outline");
      return;
    }
    setSelectedChapterId(chapter.id);
    setSelectedVolumeId(null);
    setWriteDialog({
      chapter,
      goal: chapterGoalText(chapter),
      hook: chapter.hook || "",
      skipReview: false,
    });
  }

  function applyPendingProposal(edited?: CanonProposal) {
    const proposal = edited || pendingProposal;
    if (!proposal) return;
    const confirm = createCanonConfirmation();
    update((p) => {
      let next = applyCanonProposal(p, proposal, confirm);
      if (proposal.patch.outline) {
        const outline = proposal.patch.outline;
        const chapters = outline.chapters.map((ch) => {
          const old = next.chapters.find((c) => c.chapterId === ch.id);
          return (
            old || {
              chapterId: ch.id,
              title: ch.title,
              content: "",
              status: "idle" as const,
              updatedAt: new Date().toISOString(),
            }
          );
        });
        const fallback = next.volumes?.[0]?.id || `${next.id}:vol:1`;
        next = {
          ...next,
          chapters: chapters.map((c) => {
            const ch = outline.chapters.find((x) => x.id === c.chapterId);
            return ch ? { ...c, title: ch.title } : c;
          }),
          outlineTree: syncOutlineTree(
            next.outlineTree,
            next.volumes,
            outline.chapters,
            fallback
          ),
        };
      }
      if (proposal.patch.characters) {
        next = {
          ...next,
          characters: proposal.patch.characters.map((c) => ({
            ...c,
            confirmed: true,
          })),
        };
      }
      return appendStudioSessionEvent(next, undefined, {
        kind: "confirm",
        title: `已确认写入：${proposal.summary}`,
      });
    });
    setPendingProposal(null);
  }

  async function runReviewForChapter(chapterId: string) {
    const live = getLive() || project;
    if (!live) return;
    const ch = live.outline?.chapters.find((c) => c.id === chapterId);
    const row = live.chapters.find((c) => c.chapterId === chapterId);
    if (!ch || !row?.content?.trim()) {
      setError("没有可审的正文。");
      return;
    }
    setBusy(`review:${chapterId}`);
    try {
      const prev = [...(live.outline?.chapters || [])]
        .filter((c) => c.order < ch.order)
        .sort((a, b) => a.order - b.order)
        .at(-1);
      const names = (live.characters || []).map((c) => c.name).filter(Boolean);
      const data = await postGenerate({
        mode: "review_chapter",
        writingBoard: live.writingBoard,
        title: ch.title,
        content: row.content,
        outlineSummary: [ch.summary, ch.keyPoints].filter(Boolean).join("\n"),
        previousHook: prev?.hook || "",
        chapterHook: ch.hook || "",
        forbidList: [
          ...globalForbidList(live.premiseCard),
          ...(ch.forbidList || []),
        ],
        ledger: formatCharacterStateLedger(live.characterStates, names, 3),
        world: [
          formatLoreBlock(selectLoreForPrompt(live, row.content)),
          (live.canon || [])
            .filter((f) => f.locked)
            .map((f) => `${f.name}：${f.statement}`)
            .join("\n"),
        ]
          .filter(Boolean)
          .join("\n"),
      });
      const issues = Array.isArray(data.issues) ? data.issues : [];
      const reviewState = reviewStateAfterIssues(issues);
      update((p) => ({
        ...p,
        reviews: [
          {
            id: crypto.randomUUID(),
            chapterId,
            at: new Date().toISOString(),
            score: Number(data.score) || 0,
            issues,
            source: "pipeline" as const,
          },
          ...(p.reviews || []).filter((r) => r.chapterId !== chapterId),
        ],
        chapters: p.chapters.map((c) =>
          c.chapterId === chapterId ? { ...c, reviewState } : c
        ),
      }));
      goWorkspace("review");
    } catch (e) {
      reportError(e, () => void runReviewForChapter(chapterId));
    } finally {
      setBusy(null);
    }
  }

  async function runSettleForChapter(chapterId: string) {
    const live = getLive() || project;
    if (!live) return;
    const ch = live.outline?.chapters.find((c) => c.id === chapterId);
    const row = live.chapters.find((c) => c.chapterId === chapterId);
    if (!ch || !row?.content?.trim()) {
      setError("没有可结算的正文。");
      return;
    }
    setBusy(`settle:${chapterId}`);
    try {
      const openThreads = readerKnownOpenThreadTitles(live.plotThreads);
      const sumRes = await postGenerate({
        mode: "chapter_summary",
        writingBoard: live.writingBoard,
        content: row.content,
        title: ch.title,
        openThreads,
        settings: live.settings,
      });
      const raw = String(sumRes.summary || "");
      const touched = Array.isArray(sumRes.touchedThreads)
        ? (sumRes.touchedThreads as string[])
        : parseTouchedThreads(raw);
      const deltas = Array.isArray(sumRes.characterStates)
        ? sumRes.characterStates
        : [];
      update((p) =>
        applySettleToProject({
          project: p,
          chapterId,
          chapterOrder: ch.order,
          summary: raw,
          deltas,
          touchedThreads: touched,
        })
      );
      setInfo("本章入账：摘要已存，状态与伏笔已更新。可在正文页一键撤销本次写章。");
    } catch (e) {
      update((p) => markSettlePending(p, e instanceof Error ? e.message : String(e)));
      setError("结算未完成，正文已保留。可点「重跑结算」。");
    } finally {
      setBusy(null);
    }
  }

  async function runWritePipeline(
    chapter: OutlineChapter,
    opts?: { fromJob?: boolean; skipReview?: boolean; force?: boolean }
  ): Promise<"done" | "error" | "cancelled" | "skipped"> {
    const live = getLive() || project;
    if (!live) return "error";
    const pre = precheckWriteNext(live, chapter.id, {
      bookJobRunning: Boolean(opts?.fromJob)
        ? false
        : live.bookJob?.status === "running",
      hasApiKey: hasApiKey === null ? undefined : hasApiKey,
    });
    const blocking = pre.items.filter((i) => i.level === "block");
    const hardBlocks = blocking.filter(
      (i) => i.id === "api" || i.id === "storage" || i.id === "lock" || i.id === "chapter"
    );
    if (!pre.ok && (!opts?.fromJob || hardBlocks.length)) {
      setError(
        (opts?.fromJob ? hardBlocks[0] : blocking[0])?.message ||
          "写前检查未通过"
      );
      return "error";
    }
    update((p) =>
      appendStudioSessionEvent(
        beginWriteRun(p, chapter.id, { skipReview: opts?.skipReview }),
        undefined,
        { kind: "phase", title: `写章开始：${chapter.title}` },
        { kind: "writer", title: WRITER_AGENT_LABEL }
      )
    );
    update((p) => setWriteRunPhase(p, "draft"));
    const draft = await generateChapter(chapter, Boolean(opts?.force), {
      fromJob: opts?.fromJob,
      skipAutoSummary: true,
    });
    if (draft !== "done") {
      const partial = streamPreviewRef.current;
      if (draft === "cancelled" || draft === "skipped") {
        update((p) =>
          rollbackWriteRun(p, { status: "aborted", error: draft })
        );
      } else if (partial) {
        update((p) => keepPartialDraft(p, chapter.id, partial, "draft failed"));
      } else {
        update((p) => rollbackWriteRun(p, { status: "failed", error: "draft failed" }));
      }
      return draft;
    }
    if (!opts?.skipReview) {
      update((p) => setWriteRunPhase(p, "review"));
      await runReviewForChapter(chapter.id);
    } else {
      update((p) => ({
        ...p,
        reviews: [
          {
            id: crypto.randomUUID(),
            chapterId: chapter.id,
            at: new Date().toISOString(),
            score: 0,
            issues: [],
            source: "pipeline" as const,
            skipped: true,
          },
          ...(p.reviews || []),
        ],
      }));
    }
    update((p) => setWriteRunPhase(p, "settle"));
    await runSettleForChapter(chapter.id);
    update((p) => commitWriteRun(p));
    goWorkspace("manuscript");
    return "done";
  }

  function startBookJob(
    mode: BookJob["mode"] = "missing",
    volumeId?: string,
    maxChapters?: number,
    skipConfirm?: boolean
  ) {
    if (!project) return;
    if (!allowsWholeBookGenerate(project)) {
      setError(wholeBookGenerateBlockedReason());
      return;
    }
    if (!project.outline?.chapters.length) return;
    const pool = volumeId
      ? project.outline.chapters.filter(
          (c) => (c.volumeId || project.volumes?.[0]?.id) === volumeId
        )
      : project.outline.chapters;
    const n = pool.length;
    if (!n) {
      setError("该卷没有章节");
      return;
    }
    const scope = volumeId ? "本卷" : "全书";
    const label =
      mode === "all"
        ? `将按顺序重新生成${scope}全部 ${n} 章（覆盖已有正文，产生 API 费用）`
        : `将按顺序生成${scope}未完成章节（共 ${n} 章大纲，已有正文会跳过）`;
    let limit = maxChapters;
    if (!skipConfirm) {
      const def = project.settings.serialMode ? "3" : "";
      const raw = window.prompt(
        `${label}，是否继续？\n本次最多生成多少章（空=全部${project.settings.serialMode ? "，连载模式默认 3" : ""}）`,
        def
      );
      if (raw === null) return;
      const parsed = Number(raw.trim());
      if (raw.trim() && Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      } else if (project.settings.serialMode && !raw.trim()) {
        limit = 3;
      }
    }

    const job = createBookJob(pool, project.chapters, mode, volumeId, limit);
    if (!nextPendingItem(job)) {
      setError(
        mode === "missing"
          ? "所有章节已有正文。若要覆盖重写，请选「强制全部重生成」。"
          : "没有待生成章节"
      );
      return;
    }
    setBookJob(job);
    void runBookJob(job);
  }

  function pauseBookJob() {
    jobControlRef.current.pause = true;
    abortRef.current?.abort();
  }

  function skipCurrentInJob() {
    jobControlRef.current.skip = true;
    jobControlRef.current.pause = false;
    abortRef.current?.abort();
  }

  function resumeBookJob() {
    const live = getLive();
    let job = live?.bookJob as BookJob | null | undefined;
    if (!job) return;
    job = prepareJobForResume(job);
    if (!nextPendingItem(job)) {
      setError("没有待续跑的章节");
      setBookJob(finalizeBookJobStatus(job));
      return;
    }
    setBookJob(job);
    void runBookJob(job);
  }

  function retryJobErrors() {
    const live = getLive();
    let job = live?.bookJob as BookJob | null | undefined;
    if (!job) return;
    job = prepareRetryErrors(job);
    if (!nextPendingItem(job)) {
      setError("没有失败章节可重试");
      return;
    }
    setBookJob(job);
    void runBookJob(job);
  }

  function dismissBookJob() {
    if (jobControlRef.current.running) {
      pauseBookJob();
    }
    setBookJob(null);
  }

  async function maybeAutoConsistency() {
    const prefs = loadAppPrefs();
    if (!prefs.autoConsistencyAfterBookJob) return;
    const live = getLive();
    if (!live?.outline?.chapters.length) return;
    const volumeId = live.bookJob?.volumeId || live.volumes?.[0]?.id;
    const rows = buildConsistencyRows(live, { scope: "volume", volumeId });
    if (rows.length < 2) return;
    try {
      setBusy("consistency");
      const data = await postGenerate(
        attachOriginalContext(live, {
          mode: "consistency_check",
          writingBoard: live.writingBoard,
          characters: live.characters,
          background: live.background,
          chapters: rows,
        })
      );
      const coveredUpTo = rows.reduce((m, r) => Math.max(m, r.order), 0);
      const report = toConsistencyReport(data.result, coveredUpTo);
      update((p) => ({ ...p, lastConsistencyReport: report }));
      const score = report.score;
      setInfo(
        `全书生成完成 · 自动一致性 ${score != null ? `${score}/10` : ""}：${report.summary || "完成"}（可在「工具」页查看详情）`
      );
    } catch {
      /* 自动检查失败不打断主流程 */
    } finally {
      setBusy(null);
    }
  }

  const selectedContent = useMemo(() => {
    if (!project || !effectiveSelectedId) return null;
    const row =
      project.chapters.find((c) => c.chapterId === effectiveSelectedId) || null;
    if (row && streamPreview && busy === `chapter:${effectiveSelectedId}`) {
      return { ...row, content: streamPreview, status: "generating" as const };
    }
    return row;
  }, [project, effectiveSelectedId, streamPreview, busy]);

  if (!ready) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-sm text-[var(--text-muted)]">加载中…</div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="card text-center max-w-sm">
          <p className="mb-4">未找到该项目，可能已被删除。</p>
          <Link href="/" className="btn btn-primary">
            返回首页
          </Link>
        </div>
      </main>
    );
  }

  const bookJob = project.bookJob as BookJob | null | undefined;
  const writePrecheck = writeDialog
    ? precheckWriteNext(project, writeDialog.chapter.id, {
        bookJobRunning: bookJob?.status === "running",
        hasApiKey: hasApiKey === null ? undefined : hasApiKey,
      })
    : null;
  const showGuide =
    guideOpen && shouldShowOnboarding(project) && !isOnboardingDismissed(id);

  const manuscript = (
    <>
      <div className="mb-2 px-3 pt-3">
        <DailyStatusBar
          project={project}
          onJumpUnreviewed={(chapterId) => {
            setSelectedChapterId(chapterId);
            goWorkspace("review");
          }}
          onJumpOverdue={() => {
            setLibrarySection("threads");
            goWorkspace("library");
          }}
          onJumpCheckup={() => {
            setToolsSection("tools");
            goWorkspace("tools");
          }}
          onJumpVolumeClose={(volumeId) => {
            setVolumeWizardId(volumeId);
            goWorkspace("outline");
          }}
        />
      </div>
      {(workspace === "manuscript" || bookJob) && (
        <div className="px-3">
          <BookJobBar
            job={bookJob}
            busy={!!busy?.startsWith("chapter") && !!bookJob}
            onPause={pauseBookJob}
            onResume={resumeBookJob}
            onRetryErrors={retryJobErrors}
            onDismiss={dismissBookJob}
            onSkipCurrent={skipCurrentInJob}
            onSelectChapter={(chapterId) => {
              setSelectedChapterId(chapterId);
              goWorkspace("manuscript");
            }}
          />
        </div>
      )}
      <ChaptersReader
        project={project}
        library={tagLibrary}
        selectedChapterId={effectiveSelectedId}
        selectedContent={selectedContent}
        busy={busy}
        hideLegacyFlow
        onSelect={setSelectedChapterId}
        onGenerateChapter={(ch) => void runWritePipeline(ch)}
        onWriteNext={() => requestWriteNext()}
        onRerunReview={(id) => void runReviewForChapter(id)}
        onRerunSettle={(id) => void runSettleForChapter(id)}
        onSelectionChange={setAssistantSelection}
        focusOffset={focusOffset}
        canUndoWriteRun={Boolean(
          project &&
            latestUndoableWriteRun(project, effectiveSelectedId || undefined)
        )}
        onUndoWriteRun={() => {
          update((p) => undoCommittedWriteRun(p));
          setInfo("已撤销本次写章，正文与账本已回到写前。");
        }}
        contractChapterId={null}
        onRequestContract={() => requestWriteNext()}
        onPatchOutlineChapter={(chapterId, patch) => {
          update((p) => {
            if (!p.outline) return p;
            return markAuthorCanonEdit({
              ...p,
              outline: {
                ...p.outline,
                chapters: p.outline.chapters.map((c) =>
                  c.id === chapterId ? { ...c, ...patch } : c
                ),
              },
            });
          });
        }}
        onFinalizeChapter={(payload) => {
          update((p) => {
            const next = projectAfterFinalize({
              project: p,
              chapterId: payload.chapterId,
              chapterOrder: payload.chapterOrder,
              summary: payload.summary,
              deltas: payload.deltas,
              pinnedNames: payload.pinnedNames,
              threadActions: payload.threadActions,
              newThreadTitle: payload.newThreadTitle,
            });
            const ch = next.outline?.chapters.find(
              (c) => c.id === payload.chapterId
            );
            const volId = ch?.volumeId || next.volumes?.[0]?.id;
            if (volId && volumeNeedsSummaryPrompt(next, volId)) {
              queueMicrotask(() => setVolumeWizardId(volId));
            }
            return next;
          });
        }}
        onHandEditSummary={(_id, order) => {
          update((p) => ({
            ...p,
            accountRepairMarks: pushAccountRepairMark(
              p.accountRepairMarks,
              order,
              "summary"
            ),
          }));
        }}
        onJumpPlot={() => {
          setLibrarySection("threads");
          goWorkspace("library");
        }}
        onJumpTools={() => goWorkspace("tools")}
        onOpenSettings={() => {
          setToolsSection("settings");
          goWorkspace("tools");
        }}
        onCancel={cancelGeneration}
        onBusy={setBusy}
        onError={setError}
        onUpdateChapterMeta={(chapterId, patch) => {
          update((p) => {
            const chapters = [...p.chapters];
            const idx = chapters.findIndex((c) => c.chapterId === chapterId);
            const base: ChapterContent =
              idx >= 0
                ? chapters[idx]
                : {
                    chapterId,
                    title: "",
                    content: "",
                    status: "idle",
                    updatedAt: new Date().toISOString(),
                  };
            const row = { ...base, ...patch, chapterId };
            if (idx >= 0) chapters[idx] = row;
            else chapters.push(row);
            return { ...p, chapters };
          });
        }}
        onCharacterStatesChange={(characterStates) =>
          update((p) => ({
            ...p,
            characterStates,
          }))
        }
        onContentChange={(chapterId, content, opts) => {
          const live = getLive() || project;
          const verdict = evaluateRenewalSave(content, {
            original: live.original,
            canon: live.canon,
            force: opts?.forceCanon,
          });
          if (!verdict.allowed) {
            return { ok: false, violations: verdict.violations };
          }
          update((p) => {
            const chapters = [...p.chapters];
            const idx = chapters.findIndex((c) => c.chapterId === chapterId);
            let row: ChapterContent =
              idx >= 0
                ? chapters[idx]
                : {
                    chapterId,
                    title: "",
                    content: "",
                    status: "idle",
                    updatedAt: new Date().toISOString(),
                  };
            if (opts?.pushVersion && row.content?.trim()) {
              row = pushChapterVersion(row, opts.pushVersion);
            }
            row = {
              ...row,
              content,
              status: content ? "done" : "idle",
              updatedAt: new Date().toISOString(),
              canonWarnings: verdict.violations.length
                ? verdict.violations
                : undefined,
              reviewState: opts?.pushVersion ? "draft" : row.reviewState,
            };
            if (idx >= 0) chapters[idx] = row;
            else chapters.push(row);
            return { ...p, chapters };
          });
          return { ok: true, violations: verdict.violations };
        }}
        onCommitBeatDeltas={(chapterId, deltas: BeatCommitDeltas) => {
          update((p) => {
            const row = p.chapters.find((c) => c.chapterId === chapterId);
            const accepted = (row?.scenes || []).filter(
              (s) => s.status === "accepted"
            );
            const last = accepted[accepted.length - 1];
            const applied = applyBeatDeltasToProject({
              chapters: p.chapters,
              lore: p.lore,
              threads: p.plotThreads,
              chapterId,
              deltas,
              scene: last,
            });
            return {
              ...p,
              chapters: applied.chapters,
              lore: applied.lore,
              canon: mergeCanonFacts(p.canon || [], deltas.canonProposals),
            };
          });
        }}
        onChapterTagsChange={(chapterId, tags) => {
          update((p) => {
            if (!p.outline) return p;
            return {
              ...p,
              outline: {
                ...p.outline,
                chapters: p.outline.chapters.map((c) =>
                  c.id === chapterId ? { ...c, tags } : c
                ),
              },
            };
          });
        }}
        onChapterCastChange={(chapterId, castIds) => {
          update((p) => {
            if (!p.outline) return p;
            return {
              ...p,
              outline: {
                ...p.outline,
                chapters: p.outline.chapters.map((c) =>
                  c.id === chapterId ? { ...c, castIds } : c
                ),
              },
            };
          });
        }}
        onGenerateAll={() => {
          setToolsSection("jobs");
          goWorkspace("tools");
        }}
      />
    </>
  );

  async function generateVolumeSummary(volumeId: string) {
    const live = getLive() || project;
    if (!live) return;
    const volume = (live.volumes || []).find((v) => v.id === volumeId);
    if (!volume) return;
    const chs = (live.outline?.chapters || []).filter(
      (c) => (c.volumeId || live.volumes?.[0]?.id) === volumeId
    );
    const summaries = chs.map((ch) => ({
      order: ch.order,
      title: ch.title,
      summary:
        live.chapters.find((c) => c.chapterId === ch.id)?.summary ||
        ch.summary ||
        "",
    }));
    if (!summaries.some((s) => s.summary.trim())) {
      setError("本卷各章还没有摘要，写完几章后再生成卷摘要。");
      return;
    }
    setError("");
    setBusy(`volume_summary:${volumeId}`);
    try {
      const res = await postGenerate({
        mode: "volume_summary",
        writingBoard: live.writingBoard,
        volume,
        chapterSummaries: summaries,
      });
      const draft = String(res.summary || "").trim();
      if (!draft) throw new Error("未得到卷摘要");
      setVolumeSummaryDraft({ volumeId, text: draft });
    } catch (e) {
      reportError(e, () => void generateVolumeSummary(volumeId));
    } finally {
      setBusy(null);
    }
  }

  return (
    <StudioShell
      project={project}
      workspace={workspace}
      onWorkspace={goWorkspace}
      saveHint={saveHint}
      saveError={saveError}
      busy={busy}
      onWriteNext={requestWriteNext}
      onOpenModelSettings={() => setSettingsMenuOpen(true)}
      modelSummary={modelSummary}
      onCancel={cancelGeneration}
      onNameChange={(name) => update({ name })}
      onSelectChapter={(chapterId) => {
        setSelectedChapterId(chapterId);
        goWorkspace("manuscript");
      }}
      navCollapsed={navCollapsed}
      onToggleNav={() => setNavCollapsed((v) => !v)}
      rail={
        <AssistantRail
          project={project}
          chapterId={effectiveSelectedId}
          selection={assistantSelection}
          collapsed={railCollapsed}
          onToggle={() => setRailCollapsed((v) => !v)}
          onAsk={(question, selection) => {
            update((p) =>
              appendStudioSessionEvent(
                p,
                undefined,
                {
                  kind: "message",
                  title: question,
                  detail: selection ? `选区：${selection.slice(0, 200)}` : undefined,
                },
                { kind: "writer", title: WRITER_AGENT_LABEL }
              )
            );
            setInfo("已记入 AI 协作。P0 助手提问先落会话，不自动改稿。");
            goWorkspace("sessions");
          }}
        />
      }
    >
      {saveError ? (
        <div className="px-4 pt-3">
          <div className="card !py-2.5 text-sm text-[var(--danger-text)]">
            {saveError}
            <button
              type="button"
              className="btn btn-primary btn-sm ml-2"
              onClick={() => downloadFullBackup()}
            >
              下载完整备份
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="px-4 pt-3">
          <div className="card !py-2.5 text-sm text-[var(--danger-text)] flex justify-between gap-3">
            <div className="min-w-0">
              <div>{error}</div>
              {errorDiagnostic ? (
                <details className="mt-1 text-xs text-[var(--text-muted)]">
                  <summary className="cursor-pointer">诊断详情</summary>
                  <pre className="whitespace-pre-wrap m-0 mt-1">{errorDiagnostic}</pre>
                </details>
              ) : null}
            </div>
            <div className="flex gap-1 shrink-0">
              {errorRetry ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const fn = errorRetry;
                    setError("");
                    setErrorDiagnostic("");
                    setErrorRetry(null);
                    fn();
                  }}
                >
                  重试
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setError("");
                  setErrorDiagnostic("");
                  setErrorRetry(null);
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {info ? (
        <div className="px-4 pt-3">
          <div className="card !py-2.5 text-sm flex justify-between gap-3">
            <span>{info}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInfo("")}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
      {!pendingProposal && project && pendingCanonProposals(project).length ? (
        <div className="px-4 pt-3">
          <div className="card !py-2.5 text-sm flex justify-between gap-3 items-center">
            <span>
              待确认提案 {pendingCanonProposals(project).length} 条。刷新不会丢掉产物。
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const next = pendingCanonProposals(project)[0];
                if (next) setPendingProposal(next);
              }}
            >
              打开确认闸
            </button>
          </div>
        </div>
      ) : null}
      {stalePrompt ? (
        <div className="px-4 pt-3">
          <div className="card !py-2.5 text-sm">
            上次写章未完成。
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  update((p) => rollbackWriteRun(p, { runId: stalePrompt.runId }));
                  setStalePrompt(null);
                }}
              >
                还原快照
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  update((p) => clearWriteLock(p, stalePrompt.runId));
                  setStalePrompt(null);
                }}
              >
                保留现状并清锁
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showGuide ? (
        <div className="px-4 pt-3">
          <OnboardingCard
            project={project}
            onGo={(step) => {
              goTab(step);
              if (step === "characters") {
                setCharacterEditorRequest((n) => n + 1);
              }
            }}
            onDismiss={() => {
              dismissOnboarding(id);
              setGuideOpen(false);
            }}
          />
        </div>
      ) : null}

      {workspace === "overview" ? (
        <OverviewWorkspace
          project={project}
          onOpenChapter={(cid) => {
            setSelectedChapterId(cid);
            goWorkspace("manuscript");
          }}
          onWriteNext={requestWriteNext}
        />
      ) : null}

      {workspace === "outline" ? (
        <OutlineWorkspace
          project={project}
          selectedId={selectedVolumeId ? null : effectiveSelectedId}
          selectedVolumeId={selectedVolumeId}
          onSelectChapter={(chapterId) => {
            setSelectedChapterId(chapterId);
            setSelectedVolumeId(null);
          }}
          onSelectVolume={(volumeId) => {
            setSelectedVolumeId(volumeId);
          }}
          onAddSibling={(afterId) => {
            update((p) => {
              const { project: next, chapterId } = addBlankOutlineChapter(
                p,
                afterId
              );
              setSelectedChapterId(chapterId);
              setSelectedVolumeId(null);
              return next;
            });
          }}
          onAddFirst={() => {
            update((p) => {
              const { project: next, chapterId } = addBlankOutlineChapter(p);
              setSelectedChapterId(chapterId);
              setSelectedVolumeId(null);
              return next;
            });
          }}
          onAddVolume={() => {
            update((p) => {
              const { project: next, volumeId } = addOutlineVolume(p);
              setSelectedVolumeId(volumeId);
              return next;
            });
          }}
          onWriteThisChapter={requestWriteThisChapter}
          onViewManuscript={(chapterId) => {
            setSelectedChapterId(chapterId);
            setSelectedVolumeId(null);
            goWorkspace("manuscript");
          }}
          onPatchChapter={(chapterId, partial) => {
            update((p) => patchOutlineChapter(p, chapterId, partial));
          }}
          onRemoveChapter={(chapterId) => {
            update((p) => removeOutlineChapter(p, chapterId));
            if (selectedChapterId === chapterId) setSelectedChapterId(null);
          }}
          onPolishChapter={async (ch) => {
            setError("");
            setBusy(`polish:${ch.id}`);
            try {
              const fresh = getLive() || project;
              const live =
                fresh.outline?.chapters.find((c) => c.id === ch.id) || ch;
              const data = await postGenerate(
                attachOriginalContext(fresh, {
                  mode: "polish_chapter_outline",
                  writingBoard: fresh.writingBoard,
                  characters: fresh.characters,
                  background: fresh.background,
                  settings: fresh.settings,
                  outline: fresh.outline,
                  chapter: live,
                  projectTags: fresh.tags || [],
                  premise: injectablePremise(
                    fresh.premiseCard,
                    fresh.outline
                  ),
                  includeEndingDirection,
                  endingDirection: injectableEndingDirection(
                    includeEndingDirection,
                    fresh.premiseCard
                  ),
                })
              );
              const polished = data.chapter as {
                title: string;
                summary: string;
                keyPoints: string;
                intensityNote?: string;
              };
              const liveOutline = (getLive() || project).outline;
              if (liveOutline) {
                const proposal = proposalFromPolishedChapter({
                  outline: liveOutline,
                  chapterId: ch.id,
                  beforeTitle: live.title,
                  after: polished,
                });
                update((p) => enqueueCanonDraft(p, proposal));
                setPendingProposal(proposal);
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
          onPatchVolume={(volumeId, partial) => {
            update((p) => patchOutlineVolume(p, volumeId, partial));
          }}
          onGenerateOutline={generateOutline}
          onGenerateVolumeOutline={(volumeId, n) =>
            void generateVolumeOutline(volumeId, n)
          }
          onGenerateNext={(volumeId, n) => void generateNextChapters(volumeId, n)}
          onGenerateVolumeSummary={(volumeId) =>
            void generateVolumeSummary(volumeId)
          }
          onOpenCloseWizard={(volumeId) => {
            setVolumeWizardId(volumeId);
            setSelectedVolumeId(volumeId);
          }}
          onBatchWrite={() => {
            setToolsSection("jobs");
            goWorkspace("tools");
          }}
          tagLibrary={tagLibrary}
          characters={project.characters}
          busy={busy}
          includeEndingDirection={includeEndingDirection}
          onIncludeEndingDirection={setIncludeEndingDirection}
          hideRollingOutline={!allowsWholeBookGenerate(project)}
          planChapterCount={project.settings.chapterCount}
          volumeWizard={
            volumeWizardId ? (
              <VolumeCloseWizard
                project={project}
                volumeId={volumeWizardId}
                busy={!!busy}
                onRequestSummary={() => void generateVolumeSummary(volumeWizardId)}
                onChangeVolume={(vid, patch) =>
                  update((p) => patchOutlineVolume(p, vid, patch))
                }
                onChangeThreads={(plotThreads) =>
                  update((p) => ({ ...p, plotThreads }))
                }
              />
            ) : null
          }
          volumeSummaryDraft={volumeSummaryDraft}
          onSaveSummaryDraft={() => {
            if (!volumeSummaryDraft) return;
            const { volumeId, text } = volumeSummaryDraft;
            update((p) =>
              patchOutlineVolume(p, volumeId, { summary: text.trim() })
            );
            setVolumeSummaryDraft(null);
          }}
          onDiscardSummaryDraft={() => setVolumeSummaryDraft(null)}
          onEditSummaryDraft={(text) =>
            setVolumeSummaryDraft((prev) =>
              prev ? { ...prev, text } : prev
            )
          }
        />
      ) : null}

      {workspace === "manuscript" ? (
        <div className="flex-1 min-h-0 flex flex-col px-3 py-3">{manuscript}</div>
      ) : null}

      {workspace === "review" ? (
        <ReviewWorkspace
          project={project}
          selectedChapterId={effectiveSelectedId}
          onSelectChapter={setSelectedChapterId}
          onLocate={(chapterId, offset) => {
            setSelectedChapterId(chapterId);
            setFocusOffset(offset);
            goWorkspace("manuscript");
          }}
          onReviewChapter={(cid) => void runReviewForChapter(cid)}
          busy={!!busy}
        />
      ) : null}

      {workspace === "library" ? (
        <LibraryWorkspace section={librarySection} onSection={setLibrarySection}>
          {librarySection === "intent" ? (
            <PremisePanel
              project={project}
              onChange={(premiseCard, extra) =>
                update((p) =>
                  markAuthorCanonEdit({
                    ...p,
                    premiseCard,
                    outline: p.outline
                      ? { ...p.outline, premise: premiseCard.premise }
                      : p.outline,
                    settings:
                      extra?.serialMode == null
                        ? p.settings
                        : { ...p.settings, serialMode: extra.serialMode },
                  })
                )
              }
            />
          ) : null}
          {librarySection === "focus" ? (
            <FocusPanel
              project={project}
              onChange={(fn) => update(fn)}
            />
          ) : null}
          {librarySection === "foundation" ? (
            <BackgroundPanel
              background={project.background}
              characters={project.characters}
              writingBoard={project.writingBoard}
              original={project.original}
              canon={project.canon}
              onProposeBackground={(background) => {
                const proposal = proposalFromBackground({
                  before: project.background,
                  after: background,
                });
                update((p) => enqueueCanonDraft(p, proposal));
                setPendingProposal(proposal);
              }}
              onChange={(backgroundOrFn) =>
                update((p) =>
                  markAuthorCanonEdit({
                    ...p,
                    background:
                      typeof backgroundOrFn === "function"
                        ? backgroundOrFn(p.background)
                        : backgroundOrFn,
                  })
                )
              }
              onError={setError}
            />
          ) : null}
          {librarySection === "characters" ? (
            <CharactersPanel
              characters={project.characters}
              background={project.background}
              writingBoard={project.writingBoard}
              original={project.original}
              canon={project.canon}
              characterStates={project.characterStates}
              onCharacterStatesChange={(characterStates) =>
                update((p) => ({ ...p, characterStates }))
              }
              openEditorRequest={characterEditorRequest}
              onProposeCast={(characters, background) => {
                const proposal = proposalFromCharacters({
                  kind: "cast",
                  before: project.characters,
                  after: characters,
                  background,
                });
                update((p) => enqueueCanonDraft(p, proposal));
                setPendingProposal(proposal);
              }}
              onProposeCharacter={(characters) => {
                const proposal = proposalFromCharacters({
                  kind: "character",
                  before: project.characters,
                  after: characters,
                });
                update((p) => enqueueCanonDraft(p, proposal));
                setPendingProposal(proposal);
              }}
              onChange={(charactersOrFn) =>
                update((p) =>
                  markAuthorCanonEdit({
                    ...p,
                    characters:
                      typeof charactersOrFn === "function"
                        ? charactersOrFn(p.characters)
                        : charactersOrFn,
                  })
                )
              }
              onCastGenerated={(characters, background) =>
                update((p) =>
                  markAuthorCanonEdit({ ...p, characters, background })
                )
              }
              onError={setError}
            />
          ) : null}
          {librarySection === "world" ? (
            <LorePanel
              project={project}
              onChange={(lore) =>
                update((p) => markAuthorCanonEdit({ ...p, lore }))
              }
            />
          ) : null}
          {librarySection === "threads" ? (
            <PlotThreadsPanel
              project={project}
              onChange={(plotThreads) =>
                update((p) => markAuthorCanonEdit({ ...p, plotThreads }))
              }
            />
          ) : null}
        </LibraryWorkspace>
      ) : null}

      {workspace === "sessions" ? <SessionsWorkspace project={project} /> : null}

      {workspace === "tools" ? (
        <ToolsWorkspace section={toolsSection} onSection={setToolsSection}>
          {toolsSection === "tools" ? (
            <ToolsPanel
              project={project}
              busy={busy}
              onBusy={setBusy}
              onError={setError}
              onProjectUpdate={update}
            />
          ) : null}
          {toolsSection === "settings" ? (
            <div className="space-y-4">
            <div className="card max-w-xl">
              <h3 className="text-sm font-semibold m-0 mb-2">字数规划</h3>
              <label className="block text-sm">
                全书目标字数
                <input
                  className="mt-1 w-full"
                  type="number"
                  min={0}
                  value={project.wordTargets?.book || ""}
                  onChange={(e) => {
                    const book = Number(e.target.value);
                    update((p) => ({
                      ...p,
                      wordTargets: {
                        ...p.wordTargets,
                        book: Number.isFinite(book) && book > 0 ? book : undefined,
                      },
                    }));
                  }}
                />
              </label>
            </div>
            <SettingsPanel
              settings={project.settings}
              styleLibrary={styleLibrary}
              characters={project.characters}
              background={project.background}
              writingBoard={project.writingBoard}
              original={project.original}
              canon={project.canon}
              onChange={(settings) => update((p) => ({ ...p, settings }))}
              onApplyStyle={applyLearnedStyle}
              onClearStyle={clearLearnedStyle}
              onError={setError}
            />
            </div>
          ) : null}
          {toolsSection === "tags" ? (
            <TagsPanel
              projectTags={project.tags || []}
              library={tagLibrary}
              writingBoard={project.writingBoard}
              onProjectTagsChange={(tags) => update((p) => ({ ...p, tags }))}
            />
          ) : null}
          {toolsSection === "jobs" ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)] m-0">
                批量任务已从主 CTA 降到这里。每一章仍走写前检查 → 落墨 → 审稿 → 结算。
              </p>
              <BookJobBar
                job={bookJob}
                busy={!!busy?.startsWith("chapter") && !!bookJob}
                onPause={pauseBookJob}
                onResume={resumeBookJob}
                onRetryErrors={retryJobErrors}
                onDismiss={dismissBookJob}
                onSkipCurrent={skipCurrentInJob}
                onSelectChapter={(chapterId) => {
                  setSelectedChapterId(chapterId);
                  goWorkspace("manuscript");
                }}
              />
              {allowsWholeBookGenerate(project) ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy}
                    onClick={() => startBookJob("missing")}
                  >
                    补写未完成章
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!!busy}
                    onClick={() => startBookJob("all")}
                  >
                    强制全量重写
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">焕新项目请按拍扩写。</p>
              )}
            </div>
          ) : null}
          {toolsSection === "migrate" ? (
            <OriginalPanel
              original={project.original}
              canon={project.canon || []}
              writingBoard={project.writingBoard}
              onOriginalChange={(original) =>
                update((p) => ({ ...p, original }))
              }
              onCanonChange={(canon) => update((p) => ({ ...p, canon }))}
              onApplySkeleton={(skeleton) =>
                update((p) => mapSkeletonToProject(p, skeleton))
              }
              onError={setError}
            />
          ) : null}
          {toolsSection === "styles" ? (
            <StyleLearnPanel
              styles={styleLibrary}
              onStylesChange={(s) => saveStyleLibraryFor("general", s)}
              writingBoard={project.writingBoard}
              onError={setError}
              onApply={applyLearnedStyle}
              onClear={clearLearnedStyle}
              activeId={project.settings.learnedStyleId}
              activeName={project.settings.learnedStyleName}
            />
          ) : null}
        </ToolsWorkspace>
      ) : null}

      {pendingProposal ? (
        <DiffConfirmGate
          proposal={pendingProposal}
          onConfirm={() => applyPendingProposal()}
          onReject={() => {
            update((p) => rejectCanonProposal(p, pendingProposal));
            setPendingProposal(null);
          }}
          onEdit={(edited) => applyPendingProposal(edited)}
        />
      ) : null}
      {writeDialog && writePrecheck ? (
        <WriteNextDialog
          chapter={writeDialog.chapter}
          precheck={writePrecheck}
          goal={writeDialog.goal}
          hook={writeDialog.hook}
          skipReview={writeDialog.skipReview}
          busy={!!busy}
          onGoal={(goal) => setWriteDialog({ ...writeDialog, goal })}
          onHook={(hook) => setWriteDialog({ ...writeDialog, hook })}
          onSkipReview={(skipReview) =>
            setWriteDialog({ ...writeDialog, skipReview })
          }
          onCancel={() => setWriteDialog(null)}
          onStart={() => {
            const dlg = writeDialog;
            update((p) => {
              if (!p.outline) return p;
              return markAuthorCanonEdit({
                ...p,
                outline: {
                  ...p.outline,
                  chapters: p.outline.chapters.map((c) =>
                    c.id === dlg.chapter.id
                      ? { ...c, summary: dlg.goal, hook: dlg.hook }
                      : c
                  ),
                },
              });
            });
            setWriteDialog(null);
            void runWritePipeline(
              { ...dlg.chapter, summary: dlg.goal, hook: dlg.hook },
              { skipReview: dlg.skipReview }
            );
          }}
        />
      ) : null}
      {settingsMenuOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-end p-4 bg-black/30">
          <div className="card max-w-md w-full mt-10">
            <div className="flex justify-between mb-2">
              <strong>模型设置</strong>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSettingsMenuOpen(false)}
              >
                关闭
              </button>
            </div>
            <AppSettingsMenu
              hasKey={hasApiKey}
              keyPrefix={keyPrefix}
              onImportClick={() => setSettingsMenuOpen(false)}
              onHasKeyChange={() => {
                void fetch("/api/config")
                  .then((r) => r.json())
                  .then((data) => {
                    const main = data.env?.model || "主力档";
                    const fine = data.env?.fineModel
                      ? " · 精写已配"
                      : "";
                    setModelSummary(`${main}${fine}`);
                    setHasApiKey(Boolean(data.env?.hasKey));
                    setKeyPrefix(String(data.env?.keyPrefix || ""));
                  })
                  .catch(() => undefined);
              }}
            />
          </div>
        </div>
      ) : null}
    </StudioShell>
  );
}
