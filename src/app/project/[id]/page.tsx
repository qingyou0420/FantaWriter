"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BackgroundPanel } from "@/components/BackgroundPanel";
import { BookJobBar } from "@/components/BookJobBar";
import { ChaptersReader } from "@/components/ChaptersReader";
import { CharactersPanel } from "@/components/CharactersPanel";
import { OutlinePanel } from "@/components/OutlinePanel";
import { PlotThreadsPanel } from "@/components/PlotThreadsPanel";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TagsPanel } from "@/components/TagsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToolsPanel } from "@/components/ToolsPanel";
import { VolumesPanel } from "@/components/VolumesPanel";
import { LorePanel } from "@/components/LorePanel";
import { OriginalPanel } from "@/components/OriginalPanel";
import { attachOriginalContext } from "@/lib/original";
import { useProjectStore } from "@/hooks/useProjectStore";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { ConvertModeWizard } from "@/components/ConvertModeWizard";
import { ModeBadge } from "@/components/ModeBadge";
import { boardCopy } from "@/lib/copy";
import { resolveFlag } from "@/lib/flags";
import { loadAppPrefs, saveAppPrefs } from "@/lib/theme";
import { readProjectTab, writeProjectTab } from "@/lib/storage";
import {
  buildPreviousContext,
  formatPlotThreadsForPrompt,
  postGenerate,
  streamGenerate,
} from "@/lib/api";
import {
  createBookJob,
  finalizeBookJobStatus,
  nextPendingItem,
  patchBookJobItem,
  prepareJobForResume,
  prepareRetryErrors,
  type BookJob,
} from "@/lib/book-job";
import {
  pushChapterVersion,
  type ChapterContent,
  type LearnedStyle,
  type Outline,
  type OutlineChapter,
} from "@/lib/types";

type Tab =
  | "original"
  | "characters"
  | "background"
  | "settings"
  | "tags"
  | "volumes"
  | "lore"
  | "outline"
  | "chapters"
  | "plot"
  | "progress"
  | "tools";

const TABS: { id: Tab; label: string }[] = [
  { id: "original", label: "原作焕新" },
  { id: "characters", label: "人物设定" },
  { id: "background", label: "故事背景" },
  { id: "tags", label: "本书标签" },
  { id: "lore", label: "世界观" },
  { id: "volumes", label: "分卷" },
  { id: "settings", label: "生成参数" },
  { id: "outline", label: "大纲" },
  { id: "chapters", label: "正文" },
  { id: "plot", label: "伏笔" },
  { id: "progress", label: "进度" },
  { id: "tools", label: "工具" },
];

type StageId = "setup" | "write" | "review";

const STAGES: {
  id: StageId;
  label: string;
  tabs: Tab[];
}[] = [
  {
    id: "setup",
    label: "设定",
    tabs: [
      "original",
      "characters",
      "background",
      "lore",
      "tags",
      "volumes",
      "settings",
    ],
  },
  { id: "write", label: "创作", tabs: ["outline", "chapters"] },
  { id: "review", label: "检视", tabs: ["plot", "progress", "tools"] },
];

function stageOf(tab: Tab): StageId {
  for (const s of STAGES) {
    if (s.tabs.includes(tab)) return s.id;
  }
  return "setup";
}



export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const {
    project,
    update,
    saveHint,
    tagLibrary,
    styleLibrary,
    ready,
    getLive,
  } = useProjectStore(id);

  const [tab, setTab] = useState<Tab>("characters");
  const [stage, setStage] = useState<StageId>("setup");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null
  );
  const tabRestoredRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [streamPreview, setStreamPreview] = useState("");
  /** 全书队列：暂停/跳过标志 */
  const jobControlRef = useRef<{
    pause: boolean;
    skip: boolean;
    running: boolean;
  }>({ pause: false, skip: false, running: false });
  const streamPreviewRef = useRef("");

  useEffect(() => {
    streamPreviewRef.current = streamPreview;
  }, [streamPreview]);

  // 恢复上次 Tab
  useEffect(() => {
    if (!ready || tabRestoredRef.current) return;
    tabRestoredRef.current = true;
    try {
      const saved = readProjectTab(id) as Tab | null;
      if (saved && TABS.some((t) => t.id === saved)) {
        setTab(saved);
        setStage(stageOf(saved));
      }
    } catch {
      /* ignore */
    }
  }, [ready, id]);

  function goTab(next: Tab) {
    setTab(next);
    setStage(stageOf(next));
    try {
      writeProjectTab(id, next);
    } catch {
      /* ignore */
    }
  }

  function goStage(next: StageId) {
    setStage(next);
    const group = STAGES.find((s) => s.id === next);
    if (!group) return;
    if (!group.tabs.includes(tab)) {
      goTab(group.tabs[0]);
    }
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
        goStage("setup");
      } else if (e.key === "2") {
        e.preventDefault();
        goStage("write");
      } else if (e.key === "3") {
        e.preventDefault();
        goStage("review");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  // 大纲首章：选中章无效或不存在时回落到第一项（渲染期派生，避免 effect setState）
  const outlineFirstId = project?.outline?.chapters[0]?.id ?? null;
  const effectiveSelectedId =
    selectedChapterId &&
    project?.outline?.chapters.some((c) => c.id === selectedChapterId)
      ? selectedChapterId
      : outlineFirstId;

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
      },
    }));
  }

  async function generateOutline() {
    if (!project) return;
    setError("");
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
      update({
        outline,
        chapters: outline.chapters.map((ch) => ({
          chapterId: ch.id,
          title: ch.title,
          content: "",
          status: "idle" as const,
          updatedAt: new Date().toISOString(),
        })),
        bookJob: null,
      });
      if (outline.chapters[0]) setSelectedChapterId(outline.chapters[0].id);
      setTab("outline");
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
    opts?: { fromJob?: boolean }
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
    if (!fromJob) setTab("chapters");

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
      const prior = buildPreviousContext(fresh, liveChapter.order);

      const text = await streamGenerate(
        attachOriginalContext(fresh, {
          mode: "chapter",
          writingBoard: fresh.writingBoard,
          characters: fresh.characters,
          background: fresh.background,
          settings: fresh.settings,
          outline: fresh.outline,
          chapter: liveChapter,
          previousChapterSnippet: prior.previousSnippet,
          previousSummaries: prior.previousSummaries,
          characterStateCard: prior.characterStateCard,
          priorBlock: prior.priorBlock,
          plotThreads:
            prior.plotThreads ||
            formatPlotThreadsForPrompt(fresh.plotThreads),
          lore: prior.lore,
          projectTags: fresh.tags || [],
        }),
        {
          signal: ac.signal,
          onDelta: (_d, full) => setStreamPreview(full),
        }
      );

      void postGenerate({
        mode: "chapter_summary",
        writingBoard: fresh.writingBoard,
        content: text,
        title: liveChapter.title,
      })
        .then((sumRes) => {
          update((p) => {
            const chapters = [...p.chapters];
            const idx = chapters.findIndex(
              (c) => c.chapterId === liveChapter.id
            );
            if (idx < 0) return p;
            chapters[idx] = {
              ...chapters[idx],
              summary: String(sumRes.summary || ""),
            };
            return { ...p, chapters };
          });
        })
        .catch(() => {});

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
        };
        if (idx >= 0) chapters[idx] = row;
        else chapters.push(row);
        return { ...p, chapters };
      });
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
      setError(msg);
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

    setTab("chapters");
    setError("");

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
          if (job.status === "done") {
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
            eroticNote: "",
            tags: [],
          } as OutlineChapter);

        jobControlRef.current.skip = false;
        const result = await generateChapter(outlineCh, true, { fromJob: true });

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
          job = patchBookJobItem(job, item.chapterId, {
            status: "done",
            error: undefined,
            partialContent: undefined,
          });
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

  function startBookJob(
    mode: BookJob["mode"] = "missing",
    volumeId?: string
  ) {
    if (!project?.outline?.chapters.length) return;
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
    if (!confirm(`${label}，是否继续？`)) return;

    const job = createBookJob(pool, project.chapters, mode, volumeId);
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
    const rows = [...live.outline.chapters]
      .sort((a, b) => a.order - b.order)
      .map((ch) => {
        const body =
          live.chapters.find((c) => c.chapterId === ch.id)?.content || "";
        return body
          ? { order: ch.order, title: ch.title, content: body }
          : null;
      })
      .filter(Boolean) as { order: number; title: string; content: string }[];
    if (rows.length < 2) return;
    try {
      setBusy("consistency");
      const data = await postGenerate(
        attachOriginalContext(live, {
          mode: "consistency_check",
          writingBoard: live.writingBoard,
          characters: live.characters,
          background: live.background,
          chapters: rows.slice(0, 12),
        })
      );
      const score = data.result?.score;
      const summary = data.result?.summary || "";
      setInfo(
        `全书生成完成 · 自动一致性 ${score != null ? `${score}/10` : ""}：${summary || "完成"}（可在「工具」页查看详情）`
      );
      setTab("tools");
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

  const shellMax =
    tab === "chapters" ||
    tab === "tools" ||
    tab === "plot" ||
    tab === "progress" ||
    tab === "outline"
      ? "max-w-[1680px]"
      : "max-w-6xl";

  const bookJob = project.bookJob as BookJob | null | undefined;

  return (
    <main className="flex-1 flex flex-col min-h-0 h-full">
      <header className="border-b border-[var(--border-soft)] bg-[var(--bg-elevated)]/90 backdrop-blur sticky top-0 z-20 shrink-0">
        <div
          className={`${shellMax} mx-auto px-4 py-3 flex flex-wrap items-center gap-2`}
        >
          <Link href="/" className="btn btn-ghost btn-sm">
            ← 项目
          </Link>
          <div className="flex-1 min-w-[10rem]">
            <input
              className="!border-transparent !bg-transparent !text-base !font-semibold !px-1 !py-0.5 focus:!border-[var(--border)] focus:!bg-[var(--bg)]"
              value={project.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="项目名称"
            />
          </div>
          <ModeBadge board={project.writingBoard} />
          {resolveFlag("dualBoard", loadAppPrefs()) ? (
            <BoardSwitcher
              value={project.writingBoard}
              onChange={(next) => {
                if (next === project.writingBoard) return;
                const other = boardCopy(next).label;
                if (
                  !confirm(
                    `当前书是${boardCopy(project.writingBoard).label}写作台作品。切换看板将返回首页「${other}」列表，不会修改本书。`
                  )
                ) {
                  return;
                }
                const prefs = loadAppPrefs();
                saveAppPrefs({ ...prefs, defaultBoard: next });
                window.location.href = "/";
              }}
            />
          ) : null}
          <span
            className={`status-pill ${saveHint ? "status-pill-saving" : ""}`}
            title={busy || saveHint || ""}
          >
            {busy ? (
              <>
                <span className="spinner" /> 生成中
              </>
            ) : saveHint ? (
              saveHint
            ) : (
              ""
            )}
          </span>
          <ThemeToggle />
          {busy ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={cancelGeneration}
            >
              停止
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!!busy}
            onClick={generateOutline}
          >
            {busy === "outline" ? (
              <>
                <span className="spinner" /> 大纲…
              </>
            ) : (
              "生成大纲"
            )}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!!busy || !project.outline?.chapters.length}
            onClick={() => startBookJob("missing")}
            title="跳过已有正文，只生成未完成章"
          >
            {busy?.startsWith("chapter") && bookJob?.status === "running" ? (
              <>
                <span className="spinner" /> 队列中
              </>
            ) : (
              "一键生成正文"
            )}
          </button>
          <div className="menu-wrap">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              更多 ▾
            </button>
            {moreOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default bg-transparent border-0"
                  aria-label="关闭菜单"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="menu-dropdown">
                  <button
                    type="button"
                    className="menu-item menu-item-danger"
                    disabled={!!busy || !project.outline?.chapters.length}
                    onClick={() => {
                      setMoreOpen(false);
                      if (
                        confirm(
                          "将覆盖全部已有正文并重新生成，确定继续？"
                        )
                      ) {
                        startBookJob("all");
                      }
                    }}
                  >
                    强制全量重写
                  </button>
                  <div className="menu-sep" />
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      setConvertOpen(true);
                    }}
                  >
                    转换写作台…
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      goTab("tools");
                    }}
                  >
                    打开工具页
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      goTab("progress");
                    }}
                  >
                    查看进度
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className={`${shellMax} mx-auto px-4 pb-3 stage-nav`}>
          <div className="stage-tabs" role="tablist" aria-label="创作阶段">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={stage === s.id}
                className={`stage-tab ${stage === s.id ? "active" : ""}`}
                onClick={() => goStage(s.id)}
                title={
                  s.id === "setup"
                    ? "Ctrl+1"
                    : s.id === "write"
                      ? "Ctrl+2"
                      : "Ctrl+3"
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="tabs">
            {(STAGES.find((s) => s.id === stage)?.tabs || []).map((tid) => {
              const t = TABS.find((x) => x.id === tid)!;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => goTab(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {error ? (
        <div className={`${shellMax} mx-auto w-full px-4 pt-3 shrink-0`}>
          <div className="card !py-2.5 !px-3 text-sm border-[color-mix(in_srgb,var(--danger)_40%,transparent)] text-[var(--danger-text)] flex justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setError("")}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}

      {info ? (
        <div className={`${shellMax} mx-auto w-full px-4 pt-3 shrink-0`}>
          <div className="card !py-2.5 !px-3 text-sm border-[color-mix(in_srgb,var(--accent)_35%,transparent)] text-[var(--text)] flex justify-between gap-3">
            <span>{info}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setInfo("")}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`flex-1 ${shellMax} mx-auto w-full min-h-0 flex flex-col ${
          tab === "chapters" ? "px-3 py-3" : "px-4 py-5"
        }`}
      >
        {(tab === "chapters" || bookJob) && (
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
              goTab("chapters");
            }}
          />
        )}

        {tab === "original" && (
          <OriginalPanel
            original={project.original}
            canon={project.canon || []}
            writingBoard={project.writingBoard}
            onOriginalChange={(original) =>
              update((p) => ({ ...p, original }))
            }
            onCanonChange={(canon) => update((p) => ({ ...p, canon }))}
            onError={setError}
          />
        )}
        {tab === "characters" && (
          <CharactersPanel
            characters={project.characters}
            background={project.background}
            writingBoard={project.writingBoard}
            original={project.original}
            canon={project.canon}
            onChange={(charactersOrFn) =>
              update((p) => ({
                ...p,
                characters:
                  typeof charactersOrFn === "function"
                    ? charactersOrFn(p.characters)
                    : charactersOrFn,
              }))
            }
            onCastGenerated={(characters, background) =>
              update((p) => ({ ...p, characters, background }))
            }
            onError={setError}
          />
        )}
        {tab === "background" && (
          <BackgroundPanel
            background={project.background}
            characters={project.characters}
            writingBoard={project.writingBoard}
            original={project.original}
            canon={project.canon}
            onChange={(backgroundOrFn) =>
              update((p) => ({
                ...p,
                background:
                  typeof backgroundOrFn === "function"
                    ? backgroundOrFn(p.background)
                    : backgroundOrFn,
              }))
            }
            onError={setError}
          />
        )}
        {tab === "lore" && (
          <LorePanel
            project={project}
            onChange={(lore) => update((p) => ({ ...p, lore }))}
          />
        )}
        {tab === "volumes" && (
          <VolumesPanel
            project={project}
            onChange={(volumes, outline) =>
              update((p) => ({
                ...p,
                volumes,
                outline: outline ?? p.outline,
              }))
            }
            onGenerateVolume={(volumeId) =>
              startBookJob("missing", volumeId)
            }
          />
        )}
        {tab === "tags" && (
          <TagsPanel
            projectTags={project.tags || []}
            library={tagLibrary}
            writingBoard={project.writingBoard}
            onProjectTagsChange={(tags) => update((p) => ({ ...p, tags }))}
          />
        )}
        {tab === "settings" && (
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
        )}
        {tab === "outline" && (
          <OutlinePanel
            outline={project.outline}
            projectTags={project.tags || []}
            library={tagLibrary}
            writingBoard={project.writingBoard}
            volumes={project.volumes}
            busy={busy}
            onGenerate={generateOutline}
            onChange={(outline) => {
              update((p) => {
                const chapters = outline.chapters
                  .map((ch) => {
                    const old = p.chapters.find((c) => c.chapterId === ch.id);
                    return (
                      old || {
                        chapterId: ch.id,
                        title: ch.title,
                        content: "",
                        status: "idle" as const,
                        updatedAt: new Date().toISOString(),
                      }
                    );
                  })
                  .map((c) => {
                    const ch = outline.chapters.find(
                      (x) => x.id === c.chapterId
                    );
                    return ch ? { ...c, title: ch.title } : c;
                  });
                return { ...p, outline, chapters };
              });
            }}
            onGenerateChapter={(ch) => void generateChapter(ch)}
            onPolishChapter={async (ch) => {
              setError("");
              setBusy(`polish:${ch.id}`);
              try {
                const fresh = getLive() || project;
                const live =
                  fresh.outline?.chapters.find((c) => c.id === ch.id) || ch;
                if (!(live.tags || []).length && !(fresh.tags || []).length) {
                  throw new Error(
                    "请先勾选本章标签（或本书标签），再点击「优化大纲」"
                  );
                }
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
                  })
                );
                const polished = data.chapter as {
                  title: string;
                  summary: string;
                  keyPoints: string;
                  eroticNote: string;
                };
                update((p) => {
                  if (!p.outline) return p;
                  return {
                    ...p,
                    outline: {
                      ...p.outline,
                      chapters: p.outline.chapters.map((c) =>
                        c.id === ch.id
                          ? {
                              ...c,
                              title: polished.title || c.title,
                              summary: polished.summary || c.summary,
                              keyPoints: polished.keyPoints || c.keyPoints,
                              eroticNote:
                                polished.eroticNote || c.eroticNote,
                            }
                          : c
                      ),
                    },
                  };
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            }}
          />
        )}
        {tab === "plot" && (
          <PlotThreadsPanel
            project={project}
            onChange={(plotThreads) =>
              update((p) => ({ ...p, plotThreads }))
            }
          />
        )}
        {tab === "progress" && (
          <div className="space-y-4 max-w-3xl">
            <ProgressDashboard project={project} />
          </div>
        )}
        {tab === "tools" && (
          <ToolsPanel
            project={project}
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onProjectUpdate={update}
          />
        )}
        {tab === "chapters" && (
          <ChaptersReader
            project={project}
            library={tagLibrary}
            selectedChapterId={effectiveSelectedId}
            selectedContent={selectedContent}
            busy={busy}
            onSelect={setSelectedChapterId}
            onGenerateChapter={(ch) => void generateChapter(ch, true)}
            onCancel={cancelGeneration}
            onBusy={setBusy}
            onError={setError}
            onUpdateChapterMeta={(chapterId, patch) => {
              update((p) => {
                const chapters = [...p.chapters];
                const idx = chapters.findIndex(
                  (c) => c.chapterId === chapterId
                );
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
            onContentChange={(chapterId, content, opts) => {
              update((p) => {
                const chapters = [...p.chapters];
                const idx = chapters.findIndex(
                  (c) => c.chapterId === chapterId
                );
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
                };
                if (idx >= 0) chapters[idx] = row;
                else chapters.push(row);
                return { ...p, chapters };
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
            onGenerateAll={() => startBookJob("missing")}
          />
        )}
      </div>
      {convertOpen ? (
        <ConvertModeWizard
          project={project}
          onClose={() => setConvertOpen(false)}
          onConverted={(next, inPlace) => {
            setConvertOpen(false);
            if (inPlace) {
              window.location.href = `/project/${next.id}`;
              return;
            }
            router.push(`/project/${next.id}`);
          }}
        />
      ) : null}
    </main>
  );
}
