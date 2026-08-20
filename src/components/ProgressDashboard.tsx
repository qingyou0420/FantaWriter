"use client";

import { buildBookProgress } from "@/lib/progress";
import type { NovelProject } from "@/lib/types";

export function ProgressDashboard({
  project,
  compact = false,
}: {
  project: NovelProject;
  compact?: boolean;
}) {
  const p = buildBookProgress(project);

  if (!p.totalChapters) {
    return (
      <div className={compact ? "" : "card"}>
        {!compact ? (
          <h2 className="text-base font-semibold m-0 mb-2">字数进度</h2>
        ) : null}
        <p className="text-sm text-[var(--text-muted)] m-0">
          生成大纲后显示每章字数目标与完成度。
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "card"}>
      {!compact ? (
        <h2 className="text-base font-semibold m-0 mb-1">字数进度</h2>
      ) : null}
      <p className="text-sm text-[var(--text-muted)] mt-0 mb-3">
        实写{" "}
        <strong className="text-[var(--text)]">
          {p.totalWords.toLocaleString()}
        </strong>{" "}
        / 目标约 {p.targetTotal.toLocaleString()} 字（
        {p.percentOfTarget}%）· 已写 {p.doneChapters}/{p.totalChapters} 章（
        {p.percentChapters}%）
      </p>

      <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden mb-3 border border-[var(--border-soft)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${Math.min(100, p.percentOfTarget)}%` }}
        />
      </div>

      {!compact ? (
        <ul className="list-none p-0 m-0 space-y-2 max-h-72 overflow-y-auto">
          {p.rows.map((r) => {
            const bar = Math.min(100, Math.round(r.ratio * 100));
            const under = r.words > 0 && r.words < r.min;
            const over = r.words > r.max;
            return (
              <li key={r.chapterId} className="text-sm">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="truncate">
                    第{r.order}章 {r.title}
                  </span>
                  <span
                    className={`text-xs tabular-nums shrink-0 ${
                      under
                        ? "text-[var(--warning)]"
                        : over
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-muted)]"
                    }`}
                  >
                    {r.words.toLocaleString()} / {r.target.toLocaleString()}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[var(--bg)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      under
                        ? "bg-[var(--warning)]"
                        : over
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--success)]"
                    }`}
                    style={{ width: `${bar}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!compact ? (
        <p className="text-xs text-[var(--text-muted)] mt-3 mb-0">
          目标来自「生成参数 → 章节篇幅」。黄=偏短，粉=超长。
        </p>
      ) : null}
    </div>
  );
}
