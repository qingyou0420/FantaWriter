"use client";

import { useEffect, useState } from "react";
import { scheduleDeferredWork } from "@/lib/schedule-idle";
import {
  buildOverviewStats,
  type OverviewStats,
} from "@/lib/overview-stats";
import type { NovelProject } from "@/lib/types";

export function OverviewWorkspace({
  project,
  onOpenChapter,
  onWriteNext,
}: {
  project: NovelProject;
  onOpenChapter: (id: string) => void;
  onWriteNext: () => void;
}) {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    const stop = scheduleDeferredWork(() => {
      setStats(buildOverviewStats(project));
    }, 0);
    return stop;
  }, [project]);

  if (!stats) {
    return (
      <div className="p-5 text-sm text-[var(--text-muted)]">正在整理总览…</div>
    );
  }

  const cards = [
    ["正文字数", stats.wordCount.toLocaleString()],
    ["章节", `${stats.writtenCount}/${stats.chapterCount}`],
    ["人物", String(stats.characterCount)],
    ["待处理伏笔", String(stats.openThreadCount)],
  ] as const;

  return (
    <div className="p-5 space-y-4 overflow-y-auto">
      <div className="studio-metric-grid">
        {cards.map(([label, value]) => (
          <div key={label} className="card !py-3">
            <div className="text-xs text-[var(--text-muted)]">{label}</div>
            <div className="text-xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="flex justify-between text-sm mb-2">
          <span>全书进度</span>
          <span className="text-[var(--text-muted)]">
            目标 {stats.targetWords.toLocaleString()} 字 · {stats.percentOfTarget}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--border-soft)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)]"
            style={{ width: `${Math.min(100, stats.percentOfTarget)}%` }}
          />
        </div>
      </div>
      <div className="card">
        <div className="text-sm mb-2">
          创作资产 {stats.assetReady}/{stats.assetTotal} 就绪
        </div>
        <ul className="list-none p-0 m-0 space-y-1">
          {stats.assets.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className={`studio-dot ${a.ready ? "ready" : "missing"}`} />
              {a.label}
              <span className="text-[var(--text-muted)]">
                {a.ready ? "就绪" : "缺失"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <div className="text-sm mb-2">系统建议的下一步</div>
        <p className="m-0 mb-3">{stats.nextHint}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={onWriteNext}>
          写下一章
        </button>
      </div>
      <div className="card">
        <div className="text-sm mb-2">最近章节</div>
        {stats.recent.length ? (
          <ul className="list-none p-0 m-0 space-y-1">
            {stats.recent.map((r) => (
              <li key={r.chapterId}>
                <button
                  type="button"
                  className="studio-tree-row"
                  onClick={() => onOpenChapter(r.chapterId)}
                >
                  <span>
                    第{r.order}章 · {r.title}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] ml-auto">
                    {r.words} 字 · {r.reviewLabel}
                    {r.score != null ? ` · ${r.score}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)] m-0">还没有写成的章。</p>
        )}
      </div>
    </div>
  );
}
