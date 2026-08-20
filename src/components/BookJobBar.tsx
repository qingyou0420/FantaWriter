"use client";

import { useState } from "react";
import { bookJobProgress, type BookJob } from "@/lib/book-job";

const STATUS_DOT: Record<string, string> = {
  done: "done",
  running: "running",
  error: "error",
  pending: "pending",
  skipped: "skipped",
};

export function BookJobBar({
  job,
  busy,
  onPause,
  onResume,
  onRetryErrors,
  onDismiss,
  onSkipCurrent,
  onSelectChapter,
}: {
  job: BookJob | null | undefined;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetryErrors: () => void;
  onDismiss: () => void;
  onSkipCurrent: () => void;
  onSelectChapter?: (chapterId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!job) return null;
  const hasProgress = job.items.some(
    (i) =>
      i.status === "done" ||
      i.status === "error" ||
      i.status === "running" ||
      i.status === "pending"
  );
  if (!hasProgress && job.status === "idle") return null;

  const p = bookJobProgress(job);
  const statusLabel =
    job.status === "running"
      ? "生成中"
      : job.status === "paused"
        ? "已暂停"
        : job.status === "done"
          ? "已完成"
          : job.status === "error"
            ? "有失败章"
            : "待命";

  const current = job.items.find((i) => i.chapterId === job.currentChapterId);

  return (
    <div className="card !py-2.5 !px-3 border-[rgba(196,92,138,0.35)] mb-3 shrink-0">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="badge">
              {job.volumeId ? "本卷队列" : "全书队列"}
            </span>
            <span className="font-medium">{statusLabel}</span>
            <span className="text-xs text-[var(--text-muted)]">
              {p.done}/{p.total}
              {p.error ? ` · 失败 ${p.error}` : ""}
              {p.pending ? ` · 待写 ${p.pending}` : ""}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm !py-0.5 !px-1.5 text-xs"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "收起列表" : "章节列表"}
            </button>
          </div>
          {current ? (
            <p className="text-xs text-[var(--text-muted)] mt-1 mb-0 truncate">
              当前：第 {current.order} 章《{current.title}》
            </p>
          ) : null}
          <div className="mt-2 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent,#c45c8a)] transition-all duration-300"
              style={{ width: `${p.percent}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {job.status === "running" || busy ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onPause}
              >
                暂停
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onSkipCurrent}
                title="跳过当前章，继续下一章"
              >
                跳过本章
              </button>
            </>
          ) : null}
          {(job.status === "paused" ||
            job.status === "error" ||
            (job.status === "idle" && p.pending > 0)) &&
          !busy ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onResume}
            >
              续跑
            </button>
          ) : null}
          {p.error > 0 && !busy ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRetryErrors}
            >
              重试失败
            </button>
          ) : null}
          {(job.status === "done" ||
            job.status === "error" ||
            job.status === "paused") &&
          !busy ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onDismiss}
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <ul className="book-job-list">
          {[...job.items]
            .sort((a, b) => a.order - b.order)
            .map((i) => (
              <li
                key={i.chapterId}
                className={i.status === "running" ? "running" : ""}
              >
                <span
                  className={`book-job-dot ${STATUS_DOT[i.status] || ""}`}
                />
                <button
                  type="button"
                  className="bg-transparent border-0 p-0 text-inherit cursor-pointer text-left truncate flex-1 min-w-0"
                  onClick={() => onSelectChapter?.(i.chapterId)}
                  disabled={!onSelectChapter}
                >
                  第{i.order}章 {i.title}
                </button>
                <span className="shrink-0 opacity-80">
                  {i.status === "done"
                    ? "完成"
                    : i.status === "running"
                      ? "进行中"
                      : i.status === "error"
                        ? "失败"
                        : i.status === "skipped"
                          ? "跳过"
                          : "待写"}
                </span>
              </li>
            ))}
        </ul>
      ) : null}

      {!expanded && p.error > 0 ? (
        <ul className="mt-2 mb-0 pl-4 text-xs text-[var(--danger-text)] space-y-0.5">
          {job.items
            .filter((i) => i.status === "error")
            .slice(0, 5)
            .map((i) => (
              <li key={i.chapterId}>
                第{i.order}章《{i.title}》: {i.error || "失败"}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
