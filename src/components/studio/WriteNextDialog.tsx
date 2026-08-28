"use client";

import { WRITER_AGENT_LABEL } from "@/lib/brand";
import type { OutlineChapter } from "@/lib/types";
import type { PrecheckItem, PrecheckResult } from "@/lib/write-pipeline";

export function WriteNextDialog({
  chapter,
  precheck,
  goal,
  hook,
  skipReview,
  busy,
  onGoal,
  onHook,
  onSkipReview,
  onCancel,
  onStart,
}: {
  chapter: OutlineChapter;
  precheck: PrecheckResult;
  goal: string;
  hook: string;
  skipReview: boolean;
  busy?: boolean;
  onGoal: (v: string) => void;
  onHook: (v: string) => void;
  onSkipReview: (v: boolean) => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/45">
      <div className="card max-w-xl w-full">
        <div className="text-xs text-[var(--text-muted)] mb-1">
          {WRITER_AGENT_LABEL} · 写前检查
        </div>
        <h2 className="text-lg font-semibold m-0 mb-2">
          第 {chapter.order} 章 · {chapter.title}
        </h2>
        <ul className="list-none p-0 m-0 mb-3 space-y-1 text-sm">
          {precheck.items.map((item: PrecheckItem) => (
            <li
              key={item.id}
              className={
                item.level === "block"
                  ? "text-[var(--danger-text)]"
                  : item.level === "warn"
                    ? "text-[var(--warning)]"
                    : "text-[var(--text-muted)]"
              }
            >
              {item.level === "block" ? "阻断" : "提醒"} · {item.message}
            </li>
          ))}
          {!precheck.items.length ? (
            <li className="text-[var(--success)]">检查通过，可以开始写。</li>
          ) : null}
        </ul>
        <label className="block text-sm mb-2">
          本章要写什么
          <textarea
            className="mt-1 w-full"
            rows={4}
            value={goal}
            onChange={(e) => onGoal(e.target.value)}
          />
        </label>
        <label className="block text-sm mb-2">
          章末钩子
          <input
            className="mt-1 w-full"
            value={hook}
            onChange={(e) => onHook(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={skipReview}
            onChange={(e) => onSkipReview(e.target.checked)}
          />
          跳过本次审稿（省一次主力档调用）
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!precheck.ok || busy}
            onClick={onStart}
          >
            开始写
          </button>
        </div>
      </div>
    </div>
  );
}
