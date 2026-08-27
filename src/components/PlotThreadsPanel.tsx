"use client";

import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import {
  chapterOrderById,
  isPlotThreadOverdue,
  maxWrittenOrder,
  plotThreadSuspension,
} from "@/lib/memory-pack";
import { threadSortRank } from "@/lib/daily-flow";
import {
  createEmptyPlotThread,
  type NovelProject,
  type PlotThread,
  type PlotThreadStatus,
  type PlotThreadVisibility,
} from "@/lib/types";

const STATUS_LABEL: Record<PlotThreadStatus, string> = {
  planted: "已埋下",
  active: "推进中",
  resolved: "已回收",
};

const VISIBILITY_LABEL: Record<PlotThreadVisibility, string> = {
  reader_known: "读者已知（进记忆包）",
  author_only: "仅作者（暗线，不泄漏）",
};

export function PlotThreadsPanel({
  project,
  onChange,
}: {
  project: NovelProject;
  onChange: (threads: PlotThread[]) => void;
}) {
  const threads = project.plotThreads || [];
  const chapters = project.outline?.chapters
    ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
    : [];
  const orderById = chapterOrderById(chapters);
  const writtenMax = maxWrittenOrder(project);
  const sortedThreads = [...threads].sort((a, b) => {
    const d =
      threadSortRank(a, orderById, writtenMax) -
      threadSortRank(b, orderById, writtenMax);
    if (d !== 0) return d;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  function updateThread(id: string, patch: Partial<PlotThread>) {
    onChange(
      threads.map((t) =>
        t.id === id
          ? { ...t, ...patch, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }

  function remove(id: string) {
    if (!confirm("删除这条线索？")) return;
    onChange(threads.filter((t) => t.id !== id));
  }

  function addThread() {
    onChange([createEmptyPlotThread("新线索"), ...threads]);
  }

  function chaptersTouching(title: string) {
    const name = title.trim();
    if (!name) return [];
    return (project.chapters || []).filter((c) =>
      (c.touchedThreads || []).some((t) => t.trim() === name)
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold m-0">伏笔 / 线索板</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-0">
              仅作者的暗线不进任何提示词；要拦 AI，请把禁令写进本章契约的禁写清单。去向是作者排程，也不注入。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={addThread}
          >
            添加线索
          </button>
        </div>
      </div>

      {!threads.length ? (
        <EmptyState
          title="暂无线索"
          description="写长篇时建议先记下关键伏笔。生成章摘要后，触及的线索会出现在这里，点一下即可标为已回收。"
          action={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={addThread}
            >
              添加线索
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedThreads.map((t) => {
            const hits = chaptersTouching(t.title);
            const suspended = plotThreadSuspension(t, orderById, writtenMax);
            const overdue = isPlotThreadOverdue(t, orderById, writtenMax);
            return (
              <div
                key={t.id}
                className={`card !p-4 space-y-3 ${
                  overdue
                    ? "border-[var(--warning)]/60 bg-[var(--warning)]/5"
                    : t.status !== "resolved" && !t.dueVolumeId
                      ? "border-[var(--warning)]/30 bg-[var(--warning)]/5"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {suspended > 0 ? (
                    <span
                      className={`badge ${
                        overdue ? "text-[var(--warning)]" : ""
                      }`}
                    >
                      悬置 {suspended} 章
                    </span>
                  ) : null}
                  {overdue ? (
                    <span className="text-[var(--warning)]">建议尽快回收</span>
                  ) : null}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="线索标题">
                    <input
                      value={t.title}
                      onChange={(e) =>
                        updateThread(t.id, { title: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="状态">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        updateThread(t.id, {
                          status: e.target.value as PlotThreadStatus,
                        })
                      }
                    >
                      {(
                        Object.keys(STATUS_LABEL) as PlotThreadStatus[]
                      ).map((k) => (
                        <option key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="可见性">
                  <select
                    value={t.visibility === "author_only" ? "author_only" : "reader_known"}
                    onChange={(e) =>
                      updateThread(t.id, {
                        visibility: e.target.value as PlotThreadVisibility,
                      })
                    }
                  >
                    {(
                      Object.keys(VISIBILITY_LABEL) as PlotThreadVisibility[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {VISIBILITY_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                {hits.length ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="badge">
                      本章触及：
                      {hits
                        .map((c) => {
                          const outline = chapters.find(
                            (ch) => ch.id === c.chapterId
                          );
                          return outline
                            ? `第${outline.order}章`
                            : c.title || c.chapterId;
                        })
                        .join("、")}
                    </span>
                    {t.status !== "resolved" ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          updateThread(t.id, {
                            status: "resolved",
                            resolveChapterId:
                              t.resolveChapterId || hits[hits.length - 1].chapterId,
                          })
                        }
                      >
                        标为已回收
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <Field label="说明 / 如何回收">
                  <textarea
                    value={t.note}
                    onChange={(e) => updateThread(t.id, { note: e.target.value })}
                    rows={2}
                  />
                </Field>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="埋下章节（可选）">
                    <select
                      value={t.plantChapterId || ""}
                      onChange={(e) =>
                        updateThread(t.id, {
                          plantChapterId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">未指定</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          第{c.order}章 {c.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="回收章节（可选）">
                    <select
                      value={t.resolveChapterId || ""}
                      onChange={(e) =>
                        updateThread(t.id, {
                          resolveChapterId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">未指定</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          第{c.order}章 {c.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="打算第几章前回收">
                    <input
                      type="number"
                      min={1}
                      value={t.dueChapterOrder ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        updateThread(t.id, {
                          dueChapterOrder:
                            e.target.value.trim() && Number.isFinite(n) && n > 0
                              ? n
                              : undefined,
                        });
                      }}
                      placeholder="章序"
                    />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field
                    label="预计回收位置"
                    hint={
                      t.status !== "resolved" && !t.dueVolumeId
                        ? "未定去向"
                        : "卷级去向，不注入提示词"
                    }
                  >
                    <select
                      value={t.dueVolumeId || ""}
                      onChange={(e) =>
                        updateThread(t.id, {
                          dueVolumeId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">未定</option>
                      {(project.volumes || []).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="去向备注（仅作者）">
                    <input
                      value={t.destinationNote || ""}
                      onChange={(e) =>
                        updateThread(t.id, { destinationNote: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => remove(t.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
