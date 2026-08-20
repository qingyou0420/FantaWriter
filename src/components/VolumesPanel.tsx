"use client";

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
  onGenerateVolume,
}: {
  project: NovelProject;
  onChange: (volumes: Volume[], chapters?: NovelProject["outline"]) => void;
  onGenerateVolume: (volumeId: string) => void;
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
                    className="btn btn-primary btn-sm"
                    disabled={!count}
                    onClick={() => onGenerateVolume(v.id)}
                  >
                    生成本卷
                  </button>
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
                <textarea
                  rows={2}
                  placeholder="本卷摘要（可选）"
                  value={v.summary}
                  onChange={(e) =>
                    patchVolume(v.id, { summary: e.target.value })
                  }
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
