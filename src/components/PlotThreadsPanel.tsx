"use client";

import { Field } from "@/components/Field";
import {
  createEmptyPlotThread,
  type NovelProject,
  type PlotThread,
  type PlotThreadStatus,
} from "@/lib/types";

const STATUS_LABEL: Record<PlotThreadStatus, string> = {
  planted: "已埋下",
  active: "推进中",
  resolved: "已回收",
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

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold m-0">伏笔 / 线索板</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 mb-0">
              记录埋下与回收的线索；生成正文时会把「已埋下 / 推进中」的线索注入提示，避免遗忘。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              onChange([createEmptyPlotThread("新线索"), ...threads])
            }
          >
            添加线索
          </button>
        </div>
      </div>

      {!threads.length ? (
        <div className="card empty">暂无线索。写长篇时建议先记下关键伏笔。</div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <div key={t.id} className="card !p-4 space-y-3">
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
              <Field label="说明 / 如何回收">
                <textarea
                  value={t.note}
                  onChange={(e) => updateThread(t.id, { note: e.target.value })}
                  rows={2}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
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
          ))}
        </div>
      )}
    </div>
  );
}
