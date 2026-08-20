"use client";

import { useEffect, useState } from "react";
import { GlobalFindReplace } from "@/components/GlobalFindReplace";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { useToast } from "@/components/Toast";
import { postGenerate } from "@/lib/api";
import { getDesktop, isDesktopApp } from "@/lib/desktop";
import {
  buildTocPreview,
  exportBook,
  projectWordCount,
  type ExportFormat,
} from "@/lib/export-book";
import {
  DEFAULT_CHAPTER_EXPORT_SUBDIR,
  exportChaptersToRepo,
  pickChapterRepoRoot,
} from "@/lib/export-chapters";
import {
  downloadFullBackup,
  getAutoBackup,
  loadUsageStats,
  resetUsageStats,
} from "@/lib/storage";
import { loadAppPrefs, saveAppPrefs } from "@/lib/theme";
import {
  pushChapterVersion,
  type NovelProject,
  type UsageStats,
} from "@/lib/types";

export function ToolsPanel({
  project,
  busy,
  onBusy,
  onError,
  onProjectUpdate,
}: {
  project: NovelProject;
  busy: string | null;
  onBusy: (v: string | null) => void;
  onError: (msg: string) => void;
  onProjectUpdate: (
    patch: Partial<NovelProject> | ((p: NovelProject) => NovelProject)
  ) => void;
}) {
  const [usage, setUsage] = useState<UsageStats>(() => loadUsageStats());
  const [autoConsistency, setAutoConsistency] = useState(
    () => loadAppPrefs().autoConsistencyAfterBookJob
  );
  const [consistency, setConsistency] = useState<{
    score: number;
    summary: string;
    issues: {
      severity: string;
      detail: string;
      suggestion: string;
      character?: string;
      chapter?: string;
    }[];
  } | null>(null);
  const [outlineCheck, setOutlineCheck] = useState<{
    covered: string[];
    missing: string[];
    extra: string[];
    score: number;
    advice: string;
  } | null>(null);
  const [checkChapterId, setCheckChapterId] = useState(
    project.outline?.chapters[0]?.id || ""
  );
  const [backupInfo, setBackupInfo] = useState("");
  const [repoRoot, setRepoRoot] = useState("");
  const [repoSubdir, setRepoSubdir] = useState(DEFAULT_CHAPTER_EXPORT_SUBDIR);
  const [repoInfo, setRepoInfo] = useState("");
  const [singleChapterId, setSingleChapterId] = useState(
    project.outline?.chapters[0]?.id || ""
  );
  const toast = useToast();
  const desktop = isDesktopApp();
  const toc = buildTocPreview(project);
  const totalWords = projectWordCount(project);
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];

  useEffect(() => {
    const prefs = loadAppPrefs();
    setRepoRoot(prefs.chapterRepoRoot || "");
    setRepoSubdir(
      prefs.chapterExportSubdir ?? DEFAULT_CHAPTER_EXPORT_SUBDIR
    );
  }, []);

  useEffect(() => {
    if (
      singleChapterId &&
      chapters.some((c) => c.id === singleChapterId)
    ) {
      return;
    }
    setSingleChapterId(chapters[0]?.id || "");
  }, [chapters, singleChapterId]);

  async function runConsistency() {
    onError("");
    onBusy("consistency");
    try {
      const rows = chapters
        .map((ch) => {
          const body =
            project.chapters.find((c) => c.chapterId === ch.id)?.content || "";
          return body
            ? { order: ch.order, title: ch.title, content: body }
            : null;
        })
        .filter(Boolean) as {
        order: number;
        title: string;
        content: string;
      }[];
      if (!rows.length) throw new Error("请先生成至少一章正文");
      const data = await postGenerate({
        mode: "consistency_check",
        writingBoard: project.writingBoard,
        characters: project.characters,
        background: project.background,
        chapters: rows.slice(0, 12),
      });
      setConsistency(data.result);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
      setUsage(loadUsageStats());
    }
  }

  async function runOutlineCheck() {
    onError("");
    const ch = chapters.find((c) => c.id === checkChapterId);
    if (!ch) return;
    const content =
      project.chapters.find((c) => c.chapterId === ch.id)?.content || "";
    if (!content.trim()) {
      onError("该章尚无正文");
      return;
    }
    onBusy("outline_check");
    try {
      const data = await postGenerate({
        mode: "outline_vs_content",
        writingBoard: project.writingBoard,
        chapter: ch,
        content,
        projectTags: project.tags || [],
      });
      setOutlineCheck(data.result);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
      setUsage(loadUsageStats());
    }
  }

  async function checkAutoBackup() {
    const b = await getAutoBackup();
    if (!b) setBackupInfo("尚无自动备份（保存项目一段时间后会生成）");
    else
      setBackupInfo(
        `最近自动备份：${new Date(b.at).toLocaleString("zh-CN")}，含 ${b.projects.length} 个项目`
      );
  }

  function doExport(fmt: ExportFormat) {
    exportBook(project, fmt);
  }

  function persistRepoPrefs(root: string, subdir: string) {
    const prefs = loadAppPrefs();
    saveAppPrefs({
      ...prefs,
      chapterRepoRoot: root,
      chapterExportSubdir: subdir,
    });
  }

  async function chooseRepoRoot() {
    onError("");
    const picked = await pickChapterRepoRoot();
    if (picked.ok && picked.path) {
      setRepoRoot(picked.path);
      persistRepoPrefs(picked.path, repoSubdir);
      setRepoInfo(`导出根目录：${picked.path}`);
      toast.success("已保存导出根目录");
      return;
    }
    if (!picked.canceled) {
      onError(picked.message);
    }
  }

  function saveSubdir() {
    persistRepoPrefs(repoRoot, repoSubdir);
    setRepoInfo(
      repoSubdir.trim()
        ? `子目录已保存：${repoSubdir.trim()}`
        : "将直接写在所选根目录下"
    );
  }

  async function runRepoExport(mode: "current" | "done") {
    onError("");
    onBusy("repo_export");
    try {
      persistRepoPrefs(repoRoot, repoSubdir);
      const result = await exportChaptersToRepo(project, {
        mode,
        currentChapterId: mode === "current" ? singleChapterId : undefined,
        root: repoRoot || undefined,
        subdir: repoSubdir,
      });
      if (!result.ok) throw new Error(result.message);
      if (result.root) setRepoRoot(result.root);
      const sample = result.files.slice(0, 2).join("；");
      const more =
        result.files.length > 2 ? ` 等 ${result.files.length} 个` : "";
      setRepoInfo(
        result.root
          ? `${result.message}：${result.root}${sample ? ` · ${sample}${more}` : ""}`
          : `${result.message}${sample ? ` · ${sample}${more}` : ""}`
      );
      toast.success(result.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
    }
  }

  async function openRepoRoot() {
    const bridge = getDesktop();
    if (!bridge || !repoRoot) return;
    const r = await bridge.openPath(repoRoot);
    if (!r.ok) onError(r.message || "无法打开目录");
  }

  function toggleAutoConsistency(on: boolean) {
    setAutoConsistency(on);
    const prefs = loadAppPrefs();
    saveAppPrefs({ ...prefs, autoConsistencyAfterBookJob: on });
  }

  return (
    <div className="space-y-4">
      <ProgressDashboard project={project} />

      <GlobalFindReplace
        project={project}
        onReplace={(updates) => {
          onProjectUpdate((p) => {
            const chaptersNext = [...p.chapters];
            for (const u of updates) {
              const idx = chaptersNext.findIndex(
                (c) => c.chapterId === u.chapterId
              );
              if (idx < 0) {
                chaptersNext.push({
                  chapterId: u.chapterId,
                  title: "",
                  content: u.content,
                  status: "done",
                  updatedAt: new Date().toISOString(),
                });
                continue;
              }
              let row = chaptersNext[idx];
              if (row.content?.trim()) {
                row = pushChapterVersion(row, "global-replace");
              }
              chaptersNext[idx] = {
                ...row,
                content: u.content,
                status: u.content ? "done" : "idle",
                updatedAt: new Date().toISOString(),
              };
            }
            return { ...p, chapters: chaptersNext };
          });
        }}
      />

      {/* 目录预览 */}
      <div className="card">
        <h2 className="text-base font-semibold m-0 mb-1">全书目录预览</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0 mb-3">
          总字数约{" "}
          <strong className="text-[var(--text)]">
            {totalWords.toLocaleString()}
          </strong>{" "}
          字 · {toc.filter((t) => t.hasContent).length}/{toc.length} 章已有正文
        </p>
        {!toc.length ? (
          <p className="text-sm text-[var(--text-muted)] m-0">请先生成大纲</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-3 max-h-64 overflow-y-auto">
            {Array.from(
              toc.reduce((map, t) => {
                const key = t.volumeTitle || "未分卷";
                const list = map.get(key) || [];
                list.push(t);
                map.set(key, list);
                return map;
              }, new Map<string, typeof toc>())
            ).map(([volumeTitle, items]) => (
              <li key={volumeTitle}>
                <div className="text-xs font-medium text-[var(--text-muted)] px-2 py-1">
                  {volumeTitle}
                </div>
                <ul className="list-none p-0 m-0 space-y-1">
                  {items.map((t) => (
                    <li
                      key={t.order}
                      className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-[var(--bg-hover)]"
                    >
                      <span className="truncate">
                        第{t.order}章 {t.title}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
                        {t.hasContent
                          ? `${t.words.toLocaleString()} 字`
                          : "未写"}{" "}
                        · {t.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 导出 */}
      <div className="card">
        <h2 className="text-base font-semibold m-0 mb-2">导出全书</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["md", "Markdown"],
              ["txt", "TXT"],
              ["epub", "EPUB"],
              ["doc", "Word(.doc)"],
            ] as const
          ).map(([fmt, label]) => (
            <button
              key={fmt}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => doExport(fmt)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold m-0 mb-1">写进仓库</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0 mb-3">
          把章节正文写成{" "}
          <code className="text-xs">novels/书名/ch-章节id.md</code>
          ，方便用 Cursor 在磁盘上润色。桌面端写入你选择的目录（同一 chapterId
          再导出覆盖）；浏览器会下载 Markdown 或 ZIP，不会假装写入成功。
        </p>
        {desktop ? (
          <div className="space-y-2 mb-3">
            <label className="field-label">导出根目录（仓库或任意文件夹）</label>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="flex-1 min-w-[12rem]"
                value={repoRoot}
                onChange={(e) => setRepoRoot(e.target.value)}
                onBlur={() => persistRepoPrefs(repoRoot, repoSubdir)}
                placeholder="尚未选择；首次导出时会弹出文件夹选择"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void chooseRepoRoot()}
              >
                选择文件夹
              </button>
              {repoRoot ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void openRepoRoot()}
                >
                  打开
                </button>
              ) : null}
            </div>
            <label className="field-label">相对子目录</label>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="!w-auto min-w-[8rem]"
                value={repoSubdir}
                onChange={(e) => setRepoSubdir(e.target.value)}
                onBlur={saveSubdir}
                placeholder={DEFAULT_CHAPTER_EXPORT_SUBDIR}
              />
              <span className="text-xs text-[var(--text-muted)]">
                默认 novels；留空则直接写在根目录下
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] mt-0 mb-3">
            当前是浏览器：将下载{" "}
            <code className="text-xs">.md</code> 或按路径打包的 ZIP，请自行放到仓库的{" "}
            <code className="text-xs">{repoSubdir || "novels"}/</code> 下。
          </p>
        )}
        <div className="flex flex-wrap gap-2 items-end mb-2">
          <div className="flex-1 min-w-[12rem]">
            <label className="field-label">本章</label>
            <select
              value={singleChapterId}
              onChange={(e) => setSingleChapterId(e.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  第{c.order}章 {c.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!!busy || !chapters.length}
            onClick={() => void runRepoExport("current")}
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
            className="btn btn-secondary btn-sm"
            disabled={!!busy || !chapters.length}
            onClick={() => void runRepoExport("done")}
          >
            导出全部已完成章
          </button>
        </div>
        {repoInfo ? (
          <p className="text-xs text-[var(--text-muted)] mt-2 mb-0 break-all">
            {repoInfo}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)] mt-2 mb-0">
            已完成指章节状态为 done 且有正文。文件头含书名、章序、chapterId，正文只含本章散文。
          </p>
        )}
      </div>

      {/* 一致性 */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-base font-semibold m-0">人物一致性检查</h2>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!!busy}
            onClick={runConsistency}
          >
            {busy === "consistency" ? (
              <>
                <span className="spinner" /> 检查中
              </>
            ) : (
              "AI 检查"
            )}
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm text-[var(--text-muted)] mb-3 cursor-pointer">
          <input
            type="checkbox"
            className="!w-auto mt-0.5"
            checked={autoConsistency}
            onChange={(e) => toggleAutoConsistency(e.target.checked)}
          />
          <span>
            全书队列<strong className="text-[var(--text)]">全部完成</strong>
            后自动跑一致性检查（全局偏好，跨项目）
          </span>
        </label>
        {consistency ? (
          <div className="text-sm space-y-2">
            <p className="m-0">
              评分 <strong>{consistency.score}/10</strong> —{" "}
              {consistency.summary}
            </p>
            {consistency.issues?.length ? (
              <ul className="m-0 pl-4 space-y-1">
                {consistency.issues.map((iss, i) => (
                  <li key={i}>
                    <span className="text-[var(--accent-text)]">
                      {iss.severity}
                    </span>{" "}
                    {iss.detail}
                    {iss.suggestion ? (
                      <span className="text-[var(--text-muted)]">
                        {" "}
                        → {iss.suggestion}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[var(--text-muted)] m-0">未发现明显矛盾</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] m-0">
            对照人物卡与已写正文，找出称呼/外貌/关系等矛盾。
          </p>
        )}
      </div>

      {/* 大纲对照 */}
      <div className="card">
        <h2 className="text-base font-semibold m-0 mb-2">大纲 ↔ 正文对照</h2>
        <div className="flex flex-wrap gap-2 items-end mb-2">
          <div className="flex-1 min-w-[12rem]">
            <label className="field-label">章节</label>
            <select
              value={checkChapterId}
              onChange={(e) => setCheckChapterId(e.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  第{c.order}章 {c.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!!busy || !chapters.length}
            onClick={runOutlineCheck}
          >
            {busy === "outline_check" ? (
              <>
                <span className="spinner" /> 对照中
              </>
            ) : (
              "对照检查"
            )}
          </button>
        </div>
        {outlineCheck ? (
          <div className="text-sm space-y-1">
            <p className="m-0">
              评分 <strong>{outlineCheck.score}/10</strong>
            </p>
            <p className="m-0 text-[var(--success)]">
              已落实：{outlineCheck.covered.join("；") || "—"}
            </p>
            <p className="m-0 text-[var(--danger-text)]">
              缺失：{outlineCheck.missing.join("；") || "—"}
            </p>
            <p className="m-0 text-[var(--warning)]">
              偏离：{outlineCheck.extra.join("；") || "—"}
            </p>
            <p className="m-0 text-[var(--text-muted)]">{outlineCheck.advice}</p>
          </div>
        ) : null}
      </div>

      {/* 用量 */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-base font-semibold m-0">用量 / 字数粗估</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (confirm("清空本地用量统计？")) {
                setUsage(resetUsageStats());
              }
            }}
          >
            清零
          </button>
        </div>
        <p className="text-sm m-0 mb-1">
          请求次数 <strong>{usage.totalRequests}</strong> · 输出约{" "}
          <strong>{usage.totalCharsOut.toLocaleString()}</strong> 字
          {usage.lastUsedAt
            ? ` · 最近 ${new Date(usage.lastUsedAt).toLocaleString("zh-CN")}`
            : ""}
        </p>
        <p className="text-xs text-[var(--text-muted)] m-0">
          仅作本地粗估，非账单。DeepSeek
          计费以官网为准。费用与模型/输入输出 token 相关。
        </p>
        {Object.keys(usage.byMode).length > 0 ? (
          <ul className="text-xs text-[var(--text-muted)] mt-2 mb-0 pl-4">
            {Object.entries(usage.byMode).map(([mode, v]) => (
              <li key={mode}>
                {mode}: {v.requests} 次 / 出 {v.charsOut.toLocaleString()} 字
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* 备份 */}
      <div className="card">
        <h2 className="text-base font-semibold m-0 mb-2">备份与存储</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0 mb-2">
          项目优先存 IndexedDB（突破 localStorage
          容量）；并每约 6 小时自动备份到本机数据库。建议定期下载完整备份。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={downloadFullBackup}
          >
            下载完整备份 JSON
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={checkAutoBackup}
          >
            查看自动备份
          </button>
        </div>
        {backupInfo ? (
          <p className="text-xs text-[var(--text-muted)] mt-2 mb-0">
            {backupInfo}
          </p>
        ) : null}
      </div>
    </div>
  );
}
