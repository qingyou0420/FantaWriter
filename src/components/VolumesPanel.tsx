"use client";

import { EmptyState } from "@/components/EmptyState";
import {
  addVolume,
  chaptersInVolume,
  moveVolume,
  removeVolume,
  sortedVolumes,
} from "@/lib/volumes";
import type { NovelProject, Volume } from "@/lib/types";

export function VolumesPanel({
  project,
  onChange,
  hideWholeVolumeGenerate,
  onGenerateVolume,
  onGenerateVolumeOutline,
  onGenerateVolumeSummary,
  onGenerateNext,
  summaryDraft,
  onSaveSummaryDraft,
  onDiscardSummaryDraft,
  onEditSummaryDraft,
  busy,
}: {
  project: NovelProject;
  onChange: (volumes: Volume[], chapters?: NovelProject["outline"]) => void;
  hideWholeVolumeGenerate?: boolean;
  onGenerateVolume: (volumeId: string) => void;
  onGenerateVolumeOutline?: (volumeId: string, chapterCount: number) => void;
  onGenerateVolumeSummary?: (volumeId: string) => void;
  onGenerateNext?: (volumeId: string, chapterCount: number) => void;
  summaryDraft?: { volumeId: string; text: string } | null;
  onSaveSummaryDraft?: () => void;
  onDiscardSummaryDraft?: () => void;
  onEditSummaryDraft?: (text: string) => void;
  busy?: string | null;
}) {
  const volumes = sortedVolumes(project);

  function patchVolume(id: string, partial: Partial<Volume>) {
    onChange(volumes.map((v) => (v.id === id ? { ...v, ...partial } : v)));
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="card-title m-0">分卷</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onChange(addVolume(project))}
          >
            + 添加卷
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0 mb-3">
          大纲章节会归入某一卷。可按卷生成正文；导出时按卷分节。
        </p>
        {!volumes.length ? (
          <EmptyState
            title="还没有分卷"
            description="长篇可以先加一卷，再按卷排大纲、生成正文。"
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onChange(addVolume(project))}
              >
                添加卷
              </button>
            }
          />
        ) : (
        <ul className="list-none p-0 m-0 space-y-3">
          {volumes.map((v, i) => {
            const count = chaptersInVolume(project, v.id).length;
            return (
              <li
                key={v.id}
                className="rounded-lg border border-[var(--border-soft)] p-3"
              >
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <input
                    className="flex-1 min-w-[8rem]"
                    value={v.title}
                    onChange={(e) => patchVolume(v.id, { title: e.target.value })}
                  />
                  <span className="badge">{count} 章</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={i === 0}
                    onClick={() => onChange(moveVolume(volumes, v.id, -1))}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={i === volumes.length - 1}
                    onClick={() => onChange(moveVolume(volumes, v.id, 1))}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy || !onGenerateVolumeOutline}
                    onClick={() =>
                      onGenerateVolumeOutline?.(
                        v.id,
                        Math.max(3, project.settings.chapterCount || 10)
                      )
                    }
                  >
                    {busy === `outline_volume:${v.id}` ? (
                      <>
                        <span className="spinner" /> 排大纲
                      </>
                    ) : (
                      "为本卷生成大纲"
                    )}
                  </button>
                  {!hideWholeVolumeGenerate && onGenerateNext ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!busy}
                      onClick={() =>
                        onGenerateNext(
                          v.id,
                          Math.max(
                            1,
                            Math.min(20, project.settings.chapterCount || 10)
                          )
                        )
                      }
                    >
                      {busy?.startsWith("outline_next") ? (
                        <>
                          <span className="spinner" /> 续排中…
                        </>
                      ) : (
                        `续排本卷 ${Math.max(1, Math.min(20, project.settings.chapterCount || 10))} 章`
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!!busy || !onGenerateVolumeSummary}
                    onClick={() => onGenerateVolumeSummary?.(v.id)}
                  >
                    {busy === `volume_summary:${v.id}` ? (
                      <>
                        <span className="spinner" /> 摘要…
                      </>
                    ) : (
                      "AI 生成本卷摘要"
                    )}
                  </button>
                  {hideWholeVolumeGenerate ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      已挂原作：请到正文页按拍扩写
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!count || !!busy}
                      onClick={() => onGenerateVolume(v.id)}
                    >
                      生成本卷
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !text-[#d45c6a]"
                    disabled={volumes.length <= 1}
                    onClick={() => {
                      if (!confirm("删除该卷？其章节会归入第一卷。")) return;
                      const next = removeVolume(project, v.id);
                      onChange(next.volumes, {
                        premise: project.outline?.premise || "",
                        endingNote: project.outline?.endingNote || "",
                        chapters: next.chapters,
                        raw: project.outline?.raw,
                      });
                    }}
                  >
                    删除
                  </button>
                </div>
                {summaryDraft?.volumeId === v.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      placeholder="本卷摘要（可多行）"
                      value={summaryDraft.text}
                      onChange={(e) => onEditSummaryDraft?.(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={onSaveSummaryDraft}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={onDiscardSummaryDraft}
                      >
                        放弃
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    rows={2}
                    placeholder="本卷摘要（可选）"
                    value={v.summary}
                    onChange={(e) =>
                      patchVolume(v.id, { summary: e.target.value })
                    }
                  />
                )}
                <textarea
                  className="mt-2"
                  rows={2}
                  placeholder="本卷弧线目标（可选）"
                  value={v.arcGoal || ""}
                  onChange={(e) =>
                    patchVolume(v.id, { arcGoal: e.target.value })
                  }
                />
                <textarea
                  className="mt-2"
                  rows={2}
                  placeholder="出卷局面（可选）"
                  value={v.exitState || ""}
                  onChange={(e) =>
                    patchVolume(v.id, { exitState: e.target.value })
                  }
                />
              </li>
            );
          })}
        </ul>
        )}
      </div>
    </div>
  );
}
