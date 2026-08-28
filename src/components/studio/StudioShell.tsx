"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { APP_DISPLAY_NAME_ZH } from "@/lib/brand";
import { STUDIO_NAV, type StudioWorkspace } from "@/lib/project-tabs";
import type { NovelProject } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChapterNavList } from "./ChapterNavList";

export function StudioShell({
  project,
  workspace,
  onWorkspace,
  saveHint,
  saveError,
  busy,
  onWriteNext,
  onOpenModelSettings,
  modelSummary,
  onCancel,
  onNameChange,
  onSelectChapter,
  navCollapsed,
  onToggleNav,
  rail,
  children,
}: {
  project: NovelProject;
  workspace: StudioWorkspace;
  onWorkspace: (id: StudioWorkspace) => void;
  saveHint?: string;
  saveError?: string;
  busy?: string | null;
  onWriteNext: () => void;
  onOpenModelSettings: () => void;
  modelSummary: string;
  onCancel?: () => void;
  onNameChange: (name: string) => void;
  onSelectChapter: (chapterId: string) => void;
  navCollapsed: boolean;
  onToggleNav: () => void;
  rail?: ReactNode;
  children: ReactNode;
}) {
  const showRail =
    workspace === "overview" ||
    workspace === "manuscript" ||
    workspace === "review";

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <Link href="/" className="btn btn-ghost btn-sm">
          ← {APP_DISPLAY_NAME_ZH}
        </Link>
        <input
          className="!border-transparent !bg-transparent !text-base !font-semibold !px-1 !py-0.5 focus:!border-[var(--border)] focus:!bg-[var(--bg)] min-w-[8rem] flex-1"
          value={project.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="作品名"
        />
        <span
          className={`status-pill ${
            saveError ? "status-pill-error" : saveHint ? "status-pill-saving" : ""
          }`}
        >
          {busy ? (
            <>
              <span className="spinner" /> 运行中
            </>
          ) : (
            saveError || saveHint || ""
          )}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onOpenModelSettings}
          title="模型设置"
        >
          {modelSummary}
        </button>
        <ThemeToggle />
        {busy ? (
          <button type="button" className="btn btn-danger btn-sm" onClick={onCancel}>
            停止
          </button>
        ) : null}
        <button type="button" className="btn btn-primary btn-sm" onClick={onWriteNext}>
          写下一章
        </button>
      </header>
      <div className="studio-body relative">
        <nav className={`studio-nav ${navCollapsed ? "collapsed" : ""}`}>
          <button
            type="button"
            className="studio-nav-item"
            onClick={onToggleNav}
          >
            {navCollapsed ? "☰" : "收起导航"}
          </button>
          {STUDIO_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`studio-nav-item ${workspace === item.id ? "active" : ""}`}
              onClick={() => onWorkspace(item.id)}
              title={item.label}
            >
              {navCollapsed ? item.label.slice(0, 1) : item.label}
            </button>
          ))}
          <div className="mt-auto border-t border-[var(--border-soft)] flex flex-col min-h-0 max-h-[40%]">
            {navCollapsed ? (
              <div className="text-center text-xs py-2 text-[var(--text-muted)]">章</div>
            ) : (
              <>
                <div className="text-xs text-[var(--text-muted)] px-3 py-1">
                  正文章节
                </div>
                <ChapterNavList
                  project={project}
                  selectedId={null}
                  onSelect={onSelectChapter}
                />
              </>
            )}
          </div>
        </nav>
        <div className="studio-main">{children}</div>
        {showRail ? rail : null}
      </div>
    </div>
  );
}
