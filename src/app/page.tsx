"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSettingsMenu } from "@/components/AppSettingsMenu";
import { APP_COPY } from "@/lib/copy";
import { APP_DISPLAY_NAME, APP_DISPLAY_NAME_ZH } from "@/lib/brand";
import {
  createEmptyOriginalManuscript,
  createEmptyProject,
  type NovelProject,
} from "@/lib/types";
import {
  homeCreateFieldsDisabledState,
} from "@/lib/home-boot";
import { scheduleDeferredWork } from "@/lib/schedule-idle";
import { hasOriginalText } from "@/lib/original";
import { saveAppPrefs, loadAppPrefs } from "@/lib/theme";
import {
  deleteProject,
  exportProjectJson,
  importProjectJson,
  initStorage,
  isFullBackupJson,
  loadProjects,
  writeProjectTab,
  loadUsageStats,
  upsertProject,
} from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [ready, setReady] = useState(false);
  const [newName, setNewName] = useState("");
  const [createMode, setCreateMode] = useState<"scratch" | "renew">("scratch");
  const [origTitle, setOrigTitle] = useState("");
  const [origText, setOrigText] = useState("");
  const [origSource, setOrigSource] = useState("粘贴导入");
  const fileRef = useRef<HTMLInputElement>(null);
  const origFileRef = useRef<HTMLInputElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const createFieldDisabled = homeCreateFieldsDisabledState({
    storageReady: ready,
    libraryReady: ready,
  });

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyPrefix, setKeyPrefix] = useState("");

  const [libError, setLibError] = useState("");
  const [usageHint, setUsageHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Yield one macrotask so the first click/keystroke reaches the input
    // before IndexedDB + normalizeProject run on the renderer thread.
    const stop = scheduleDeferredWork(() => {
      void (async () => {
        await initStorage();
        if (cancelled) return;
        setProjects(loadProjects());
        const prefs = loadAppPrefs();
        if (prefs.defaultBoard !== "general") {
          saveAppPrefs({ ...prefs, defaultBoard: "general" });
        }
        const u = loadUsageStats();
        if (u.totalRequests > 0) {
          setUsageHint(
            `用量：${u.totalRequests} 次 · 出 ${u.totalCharsOut.toLocaleString()} 字`
          );
        }
        setReady(true);
        void refreshApiStatus();
      })();
    }, 0);
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  async function refreshApiStatus() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.env) {
        setHasKey(Boolean(data.env.hasKey));
        setKeyPrefix(data.env.keyPrefix || "");
      }
    } catch {
      setHasKey(null);
    }
  }

  function refresh() {
    setProjects(loadProjects());
  }

  async function handleCreate() {
    const confirmMsg =
      createMode === "renew"
        ? `这是「原作焕新」：依据旧稿扩写，而不是从零遍构。${APP_COPY.createConfirm}`
        : APP_COPY.createConfirm;
    if (!confirm(confirmMsg)) return;
    await initStorage();
    const typedName = (newNameRef.current?.value ?? newName).trim();
    const titleHint = origTitle.trim() || typedName;
    const project = createEmptyProject(
      typedName || titleHint || "未命名小说"
    );
    if (titleHint) {
      project.background.title = titleHint;
    }
    if (createMode === "renew") {
      const ms = createEmptyOriginalManuscript(
        origTitle.trim() || project.name,
        origSource || "粘贴导入"
      );
      ms.text = origText;
      project.original = ms;
    }
    upsertProject(project);
    if (createMode === "renew") {
      writeProjectTab(project.id, "original");
    } else {
      writeProjectTab(project.id, "overview");
    }
    router.push(`/project/${project.id}`);
  }

  function onOriginalFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setOrigText(text);
      setOrigSource(file.name);
      if (!origTitle.trim()) {
        setOrigTitle(file.name.replace(/\.[^.]+$/, ""));
      }
      const inferred = file.name.replace(/\.[^.]+$/, "");
      if (!(newNameRef.current?.value ?? newName).trim()) {
        if (newNameRef.current) newNameRef.current.value = inferred;
        setNewName(inferred);
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`确定删除「${name}」？此操作不可恢复。`)) return;
    deleteProject(id);
    refresh();
  }

  function handleExport(p: NovelProject) {
    const blob = new Blob([exportProjectJson(p)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name || "novel"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      try {
        if (isFullBackupJson(text)) {
          alert("这是完整备份，请走「导入完整备份」");
          return;
        }
        const project = importProjectJson(text);
        upsertProject(project);
        refresh();
      } catch (e) {
        if (isFullBackupJson(text)) {
          alert("这是完整备份，请走「导入完整备份」");
          return;
        }
        alert(e instanceof Error ? e.message : "导入失败");
      }
    };
    reader.readAsText(file);
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  const visibleProjects = projects;
  const copy = APP_COPY;

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-[var(--border-soft)] bg-[var(--bg-elevated)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight m-0">
              {APP_DISPLAY_NAME_ZH} / {APP_DISPLAY_NAME}
            </h1>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
              {copy.audience}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <AppSettingsMenu
              hasKey={hasKey}
              keyPrefix={keyPrefix}
              usageHint={usageHint}
              onImportClick={() => fileRef.current?.click()}
              onImportFullBackup={() => refresh()}
              onHasKeyChange={() => void refreshApiStatus()}
            />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 pb-3 text-xs text-[var(--text-muted)]">
          书架 · {visibleProjects.length} 部。标签库与文风学习已移入项目内「工具与设置」。
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full px-5 py-8 flex-1">
        {hasKey === false ? (
          <div className="card mb-6 !py-3 text-sm text-[#f0c0a0] border-[rgba(212,162,76,0.4)]">
            尚未配置 API Key。请打开右上角「设置 → API 设置」。
          </div>
        ) : null}

        {libError ? (
          <div className="card mb-4 !py-2.5 text-sm text-[var(--danger-text)] flex justify-between gap-3">
            <span>{libError}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setLibError("")}
            >
              关闭
            </button>
          </div>
        ) : null}

        <>
            <section className="card mb-8">
              <h2 className="card-title">新建小说项目</h2>
              <div className="tabs mb-3">
                <button
                  type="button"
                  className={`tab ${createMode === "scratch" ? "active" : ""}`}
                  onClick={() => setCreateMode("scratch")}
                >
                  从零开写
                </button>
                <button
                  type="button"
                  className={`tab ${createMode === "renew" ? "active" : ""}`}
                  onClick={() => setCreateMode("renew")}
                >
                  从旧稿迁入
                </button>
              </div>
              {createMode === "renew" ? (
                <p className="text-sm text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
                  项目迁移：导入旧稿后在「工具与设置 → 项目迁移」锁定事实、抽骨架。
                  这不是首页主路径。
                </p>
              ) : (
                <p className="text-sm text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
                  {copy.emptyProjects}
                </p>
              )}
              {/* Uncontrolled so the field accepts typing before hydration / initStorage. */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={newNameRef}
                  name="project-name"
                  placeholder="项目名称"
                  defaultValue=""
                  autoComplete="off"
                  spellCheck={false}
                  disabled={createFieldDisabled["project-name"]}
                  onInput={(e) => setNewName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && createMode === "scratch") {
                      void handleCreate();
                    }
                  }}
                />
                {createMode === "scratch" ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreate}
                  >
                    创建并打开
                  </button>
                ) : null}
              </div>
              {createMode === "renew" ? (
                <div className="mt-3 space-y-3">
                  <input
                    name="original-title"
                    placeholder="原作标题"
                    value={origTitle}
                    disabled={createFieldDisabled["original-title"]}
                    onChange={(e) => setOrigTitle(e.target.value)}
                  />
                  <textarea
                    name="original-text"
                    rows={8}
                    className="!font-mono !text-[0.85rem]"
                    placeholder="把旧稿全文贴在这里…"
                    value={origText}
                    disabled={createFieldDisabled["original-text"]}
                    onChange={(e) => {
                      setOrigText(e.target.value);
                      if (origSource === "粘贴导入" || !origSource) {
                        setOrigSource("粘贴导入");
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      ref={origFileRef}
                      type="file"
                      accept=".txt,.md,.text,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onOriginalFile(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => origFileRef.current?.click()}
                    >
                      导入文件
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreate}
                    >
                      挂上原作并打开
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">
                      {origText.length} 字
                      {origSource ? ` · ${origSource}` : ""}
                    </span>
                  </div>
                </div>
              ) : null}
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold m-0">我的项目</h2>
                <span className="badge badge-muted">{visibleProjects.length} 部</span>
              </div>

              {!ready ? (
                <div className="empty">加载中…</div>
              ) : visibleProjects.length === 0 ? (
                <div className="card empty">
                  {copy.emptyProjects}
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
                  {visibleProjects.map((p) => (
                    <li key={p.id} className="card !p-0 overflow-hidden group">
                      <button
                        type="button"
                        className="w-full text-left p-4 bg-transparent border-0 cursor-pointer text-inherit"
                        onClick={() => router.push(`/project/${p.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[0.95rem] font-semibold m-0 leading-snug">
                            {p.name || "未命名"}
                          </h3>
                          <div className="flex items-center gap-1 shrink-0">
                          {hasOriginalText(p.original) ? (
                            <span className="badge shrink-0">旧稿迁入</span>
                          ) : null}
                          <span className="badge shrink-0">
                            {p.outline?.chapters.length
                              ? `${p.outline.chapters.length} 章大纲`
                              : "待写大纲"}
                          </span>
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-2 mb-0 line-clamp-2 leading-relaxed">
                          {p.background.synopsis ||
                            p.background.setting ||
                            "尚未填写故事背景"}
                        </p>
                        <div className="flex items-center gap-3 mt-3 text-[0.7rem] text-[var(--text-muted)]">
                          <span>
                            {(p.tags || []).length
                              ? `${p.tags.length} 标签`
                              : "无标签"}
                          </span>
                          <span>·</span>
                          <span>
                            {p.settings?.learnedStyleName
                              ? p.settings.learnedStyleName
                              : "默认文风"}
                          </span>
                          <span>·</span>
                          <span>更新 {formatDate(p.updatedAt)}</span>
                        </div>
                      </button>
                      <div className="flex border-t border-[var(--border-soft)] px-2 py-1.5 gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm flex-1"
                          onClick={() => handleExport(p)}
                        >
                          导出
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm flex-1 !text-[#d45c6a]"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
        </>

      </div>

      <footer className="text-center text-[0.7rem] text-[var(--text-muted)] py-6 border-t border-[var(--border-soft)]">
        {copy.footer}
      </footer>
    </main>
  );
}
