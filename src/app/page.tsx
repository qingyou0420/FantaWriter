"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TagLibraryManager } from "@/components/TagEditor";
import { StyleLearnPanel } from "@/components/StyleLearnPanel";
import { AppSettingsMenu } from "@/components/AppSettingsMenu";
import { APP_COPY } from "@/lib/copy";
import {
  createEmptyOriginalManuscript,
  createEmptyProject,
  type LearnedStyle,
  type NovelProject,
} from "@/lib/types";
import { hasOriginalText } from "@/lib/original";
import { saveAppPrefs, loadAppPrefs } from "@/lib/theme";
import {
  deleteProject,
  exportProjectJson,
  importProjectJson,
  initStorage,
  loadProjects,
  writeProjectTab,
  loadStyleLibraryFor,
  loadTagLibraryFor,
  loadUsageStats,
  resetTagLibraryToDefaultFor,
  saveTagLibraryFor,
  upsertProject,
} from "@/lib/storage";

type HomeTab = "projects" | "tags" | "styles";

export default function HomePage() {
  const router = useRouter();
  const [homeTab, setHomeTab] = useState<HomeTab>("projects");
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [ready, setReady] = useState(false);
  const [newName, setNewName] = useState("");
  const [createMode, setCreateMode] = useState<"scratch" | "renew">("scratch");
  const [origTitle, setOrigTitle] = useState("");
  const [origText, setOrigText] = useState("");
  const [origSource, setOrigSource] = useState("粘贴导入");
  const fileRef = useRef<HTMLInputElement>(null);
  const origFileRef = useRef<HTMLInputElement>(null);

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyPrefix, setKeyPrefix] = useState("");

  const [tagLibrary, setTagLibrary] = useState<string[]>([]);
  const [styleLibrary, setStyleLibrary] = useState<LearnedStyle[]>([]);
  const [libError, setLibError] = useState("");
  const [usageHint, setUsageHint] = useState("");

  useEffect(() => {
    (async () => {
      await initStorage();
      setProjects(loadProjects());
      const prefs = loadAppPrefs();
      if (prefs.defaultBoard !== "general") {
        saveAppPrefs({ ...prefs, defaultBoard: "general" });
      }
      setTagLibrary(loadTagLibraryFor("general"));
      setStyleLibrary(loadStyleLibraryFor("general"));
      const u = loadUsageStats();
      if (u.totalRequests > 0) {
        setUsageHint(
          `用量：${u.totalRequests} 次 · 出 ${u.totalCharsOut.toLocaleString()} 字`
        );
      }
      setReady(true);
      refreshApiStatus();
    })();
  }, []);

  function updateTagLibrary(next: string[]) {
    saveTagLibraryFor("general", next);
    setTagLibrary(next);
  }

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

  function handleCreate() {
    const confirmMsg =
      createMode === "renew"
        ? `这是「原作焕新」：依据旧稿扩写，而不是从零遍构。${APP_COPY.createConfirm}`
        : APP_COPY.createConfirm;
    if (!confirm(confirmMsg)) return;
    const titleHint = origTitle.trim() || newName.trim();
    const project = createEmptyProject(
      newName.trim() || titleHint || "未命名小说"
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
      if (!newName.trim()) {
        setNewName(file.name.replace(/\.[^.]+$/, ""));
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
      try {
        const project = importProjectJson(String(reader.result));
        upsertProject(project);
        refresh();
      } catch (e) {
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

  const navItems: { id: HomeTab; label: string; badge?: string }[] = [
    { id: "projects", label: "我的项目", badge: String(visibleProjects.length) },
    { id: "tags", label: copy.homeTagsTitle, badge: String(tagLibrary.length) },
    { id: "styles", label: "文风学习", badge: String(styleLibrary.length) },
  ];

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-[var(--border-soft)] bg-[var(--bg-elevated)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight m-0">
              幻想作家 / Fantasy Writer
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
              onHasKeyChange={() => void refreshApiStatus()}
            />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 pb-3">
          <div className="tabs">
            {navItems.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab ${homeTab === t.id ? "active" : ""}`}
                onClick={() => {
                  setHomeTab(t.id);
                  setLibError("");
                }}
              >
                {t.label}
                {t.badge != null ? (
                  <span className="opacity-60 text-[0.75em] ml-1">
                    ({t.badge})
                  </span>
                ) : null}
              </button>
            ))}
          </div>
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

        {homeTab === "projects" && (
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
                  原作焕新
                </button>
              </div>
              {createMode === "renew" ? (
                <p className="text-sm text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
                  贴入旧稿后扩写、润色；人设与情节以原文为准，<strong>不是从零遍构</strong>。
                  创建后请先锁一条原作里不能被改的事实（名称 + 一句话），生成时必须遵守。
                </p>
              ) : (
                <p className="text-sm text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
                  {copy.emptyProjects}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  placeholder="项目名称"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && createMode === "scratch" && handleCreate()
                  }
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
                    placeholder="原作标题"
                    value={origTitle}
                    onChange={(e) => setOrigTitle(e.target.value)}
                  />
                  <textarea
                    rows={8}
                    className="!font-mono !text-[0.85rem]"
                    placeholder="把旧稿全文贴在这里…"
                    value={origText}
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
                            <span className="badge shrink-0">原作焕新</span>
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
        )}

        {homeTab === "tags" && (
          <section className="card max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold m-0">{copy.homeTagsTitle}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (confirm(copy.resetTagsConfirm)) {
                    updateTagLibrary(resetTagLibraryToDefaultFor("general"));
                  }
                }}
              >
                恢复默认示例
              </button>
            </div>
            <TagLibraryManager
              library={tagLibrary}
              onChange={updateTagLibrary}
            />
          </section>
        )}

        {homeTab === "styles" && (
          <StyleLearnPanel
            homeMode
            writingBoard="general"
            styles={styleLibrary}
            onStylesChange={setStyleLibrary}
            onError={setLibError}
          />
        )}
      </div>

      <footer className="text-center text-[0.7rem] text-[var(--text-muted)] py-6 border-t border-[var(--border-soft)]">
        {copy.footer}
      </footer>
    </main>
  );
}
