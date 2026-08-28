"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/Field";
import {
  canMarkReviewed,
  emptyFinalizeProgress,
  type FinalizeProgress,
} from "@/lib/finalize-chapter";
import { formatStateDeltaNote } from "@/lib/character-states";
import type {
  ChapterContent,
  NovelProject,
  OutlineChapter,
  PendingStateDelta,
  PlotThreadStatus,
} from "@/lib/types";

export function FinalizePanel({
  project,
  chapter: _chapter,
  content,
  onClose,
  onCommit,
}: {
  project: NovelProject;
  chapter: OutlineChapter;
  content: ChapterContent;
  onClose: () => void;
  onCommit: (payload: {
    summary: string;
    deltas: PendingStateDelta[];
    pinnedNames: string[];
    threadActions: { title: string; action: "active" | "resolved" | "keep" }[];
    newThreadTitle: string;
    skipped: FinalizeProgress;
  }) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [summary, setSummary] = useState(content.summary || "");
  const [progress, setProgress] = useState<FinalizeProgress>(
    emptyFinalizeProgress()
  );
  const [deltas, setDeltas] = useState<PendingStateDelta[]>(
    () => [...(content.pendingStateDeltas || [])]
  );
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [threadActions, setThreadActions] = useState<
    Record<string, "active" | "resolved" | "keep">
  >({});
  const [newThreadTitle, setNewThreadTitle] = useState("");

  const touched = useMemo(() => {
    const titles = content.touchedThreads || [];
    return titles.filter(Boolean);
  }, [content.touchedThreads]);

  function skip(which: keyof FinalizeProgress) {
    setProgress((p) => ({ ...p, [which]: true }));
    if (which === "summary") setStep(2);
    if (which === "ledger") setStep(3);
    if (which === "threads") setStep(4);
  }

  function done(which: keyof FinalizeProgress, next: 1 | 2 | 3 | 4) {
    setProgress((p) => ({ ...p, [which]: true }));
    setStep(next);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold m-0">定稿四件套</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-0">
            过摘要、过账本、过伏笔，才能标已审。某步可显式跳过。
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          取消
        </button>
      </div>
      <ol className="text-xs text-[var(--text-muted)] m-0 pl-4">
        <li className={step === 1 ? "text-[var(--text)]" : ""}>
          过摘要 {progress.summary ? "✓" : ""}
        </li>
        <li className={step === 2 ? "text-[var(--text)]" : ""}>
          过账本 {progress.ledger ? "✓" : ""}
        </li>
        <li className={step === 3 ? "text-[var(--text)]" : ""}>
          过伏笔 {progress.threads ? "✓" : ""}
        </li>
        <li className={step === 4 ? "text-[var(--text)]" : ""}>标已审</li>
      </ol>

      {step === 1 ? (
        <div className="space-y-2">
          <Field label="本章摘要" hint="错一个称呼就手改。摘要是写给未来的 AI 的。">
            <textarea
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => done("summary", 2)}
            >
              摘要没问题
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => skip("summary")}
            >
              跳过摘要
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] m-0">
            AI 提议的人物状态增量。点入账才合并；确认前不进下一章记忆包。
          </p>
          {!deltas.length ? (
            <p className="text-sm m-0">本章没有待确认的状态变化。</p>
          ) : (
            <ul className="list-none p-0 m-0 space-y-2">
              {deltas.map((d, i) => (
                <li
                  key={`${d.name}-${i}`}
                  className="rounded-lg border border-[var(--border-soft)] p-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{d.name}</strong>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setPinnedNames((prev) =>
                            prev.includes(d.name)
                              ? prev.filter((n) => n !== d.name)
                              : [...prev, d.name]
                          )
                        }
                      >
                        {pinnedNames.includes(d.name) ? "取消置顶" : "置顶写死"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setDeltas((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <input
                    className="mt-1"
                    value={formatStateDeltaNote(d)}
                    onChange={(e) => {
                      const note = e.target.value;
                      setDeltas((prev) =>
                        prev.map((row, j) =>
                          j === i ? { name: row.name, goal: note } : row
                        )
                      );
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => done("ledger", 3)}
            >
              入账
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => skip("ledger")}
            >
              跳过账本
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] m-0">
            本章触及的伏笔。推进中 / 已回收 / 不动。
          </p>
          {!touched.length ? (
            <p className="text-sm m-0">摘要未标触及伏笔。</p>
          ) : (
            <ul className="list-none p-0 m-0 space-y-2">
              {touched.map((title) => {
                const current = project.plotThreads?.find(
                  (t) => t.title.trim() === title
                );
                const action = threadActions[title] || "keep";
                return (
                  <li key={title} className="text-sm">
                    <div className="font-medium">{title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      现状态：{statusLabel(current?.status)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(
                        [
                          ["keep", "不动"],
                          ["active", "推进中"],
                          ["resolved", "已回收"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`btn btn-sm ${
                            action === id ? "btn-secondary" : "btn-ghost"
                          }`}
                          onClick={() =>
                            setThreadActions((prev) => ({
                              ...prev,
                              [title]: id,
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Field label="补记一条" hint="本章新埋的伏笔。">
            <input
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              placeholder="新伏笔标题"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => done("threads", 4)}
            >
              伏笔已过
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => skip("threads")}
            >
              跳过伏笔
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-2">
          <p className="text-sm m-0">
            {canMarkReviewed(progress)
              ? "四件套已齐（含显式跳过）。可以把这章标为已审。"
              : "还有步骤没走完。"}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canMarkReviewed(progress)}
            onClick={() =>
              onCommit({
                summary,
                deltas,
                pinnedNames,
                threadActions: Object.entries(threadActions).map(
                  ([title, action]) => ({ title, action })
                ),
                newThreadTitle,
                skipped: progress,
              })
            }
          >
            标为已审
          </button>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(status?: PlotThreadStatus) {
  if (status === "resolved") return "已回收";
  if (status === "active") return "推进中";
  if (status === "planted") return "已埋下";
  return "未见";
}
