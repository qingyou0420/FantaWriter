"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/Field";
import { listOpenThreadsWithoutDestination } from "@/lib/daily-flow";
import { formatCharacterStateLedger } from "@/lib/character-states";
import { chaptersInVolume, sortedVolumes } from "@/lib/volumes";
import type {
  NovelProject,
  PlotThread,
  Volume,
  VolumeExitSnapshot,
} from "@/lib/types";

export function VolumeCloseWizard({
  project,
  volumeId,
  onChangeVolume,
  onChangeThreads,
  onRequestSummary,
  onDismiss,
  busy,
}: {
  project: NovelProject;
  volumeId: string;
  onChangeVolume: (id: string, patch: Partial<Volume>) => void;
  onChangeThreads: (threads: PlotThread[]) => void;
  onRequestSummary?: () => void;
  onDismiss?: () => void;
  busy?: boolean;
}) {
  const volume = (project.volumes || []).find((v) => v.id === volumeId);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const names = useMemo(() => {
    const cast = new Set(
      chaptersInVolume(project, volumeId).flatMap((ch) => ch.castIds || [])
    );
    const chars = cast.size
      ? project.characters.filter((c) => cast.has(c.id))
      : project.characters;
    return chars.map((c) => c.name).filter(Boolean);
  }, [project, volumeId]);

  if (!volume) return null;

  const snapshots =
    volume.exitSnapshots?.length
      ? volume.exitSnapshots
      : names.map((name) => ({
          name,
          note: formatCharacterStateLedger(project.characterStates, [name], 2),
        }));
  const open = (project.plotThreads || []).filter((t) => t.status !== "resolved");
  const missingDest = listOpenThreadsWithoutDestination(open);
  const nextVols = sortedVolumes(project).filter((v) => v.order > volume.order);

  return (
    <div className="card space-y-3 border-[var(--warning)]/40">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold m-0">过卷向导 · {volume.title}</h2>
        {onDismiss ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onDismiss}
          >
            关闭
          </button>
        ) : null}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-0 mb-0">
        冻结四样：卷摘要、出卷人物快照、伏笔去向、时间线落点。新卷第一章只靠这些立契约。
      </p>
      {project.premiseCard?.coreConflict?.trim() ? (
        <p className="text-xs m-0">核心对抗（仅作者）：{project.premiseCard.coreConflict}</p>
      ) : null}
      <ol className="text-xs pl-4 m-0">
        <li>卷摘要</li>
        <li>出卷人物快照</li>
        <li>伏笔清点</li>
        <li>时间线落点</li>
      </ol>

      {step === 1 ? (
        <div className="space-y-2">
          <Field label="卷摘要">
            <textarea
              rows={4}
              value={volume.summary}
              onChange={(e) =>
                onChangeVolume(volume.id, { summary: e.target.value })
              }
            />
          </Field>
          {onRequestSummary ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={onRequestSummary}
            >
              AI 起草卷摘要
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep(2)}>
            下一步
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2">
          {snapshots.map((s, i) => (
            <Field key={s.name || i} label={s.name || `人物 ${i + 1}`}>
              <textarea
                rows={2}
                value={s.note}
                onChange={(e) => {
                  const next = snapshots.map((row, j) =>
                    j === i ? { ...row, note: e.target.value } : row
                  );
                  onChangeVolume(volume.id, { exitSnapshots: next });
                }}
              />
            </Field>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
              上一步
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!volume.exitSnapshots?.length) {
                  onChangeVolume(volume.id, {
                    exitSnapshots: snapshots as VolumeExitSnapshot[],
                  });
                }
                setStep(3);
              }}
            >
              下一步
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2">
          {!open.length ? (
            <p className="text-sm m-0">没有开放伏笔。</p>
          ) : (
            <ul className="list-none p-0 m-0 space-y-2">
              {open.map((t) => (
                <li key={t.id} className="text-sm">
                  <div className="font-medium">
                    {t.title}
                    {!t.dueVolumeId ? (
                      <span className="text-[var(--danger)] ml-2">未定去向</span>
                    ) : null}
                  </div>
                  <select
                    className="mt-1"
                    value={t.dueVolumeId || ""}
                    onChange={(e) =>
                      onChangeThreads(
                        (project.plotThreads || []).map((x) =>
                          x.id === t.id
                            ? { ...x, dueVolumeId: e.target.value || undefined }
                            : x
                        )
                      )
                    }
                  >
                    <option value="">未定</option>
                    <option value={volume.id}>本卷收</option>
                    {nextVols.map((v) => (
                      <option key={v.id} value={v.id}>
                        去{v.title}
                      </option>
                    ))}
                  </select>
                  <input
                    className="mt-1"
                    placeholder="去向备注（不注入）"
                    value={t.destinationNote || ""}
                    onChange={(e) =>
                      onChangeThreads(
                        (project.plotThreads || []).map((x) =>
                          x.id === t.id
                            ? { ...x, destinationNote: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {missingDest.length ? (
            <p className="text-xs text-[var(--danger)] m-0">
              还有 {missingDest.length} 条开放伏笔没有去向，不许无去向出卷。
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>
              上一步
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep(4)}>
              下一步
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-2">
          <Field label="时间线落点" hint="故事此刻是何年何月。">
            <input
              value={volume.timelineAnchor || ""}
              onChange={(e) =>
                onChangeVolume(volume.id, { timelineAnchor: e.target.value })
              }
              placeholder="例如：建安四年冬"
            />
          </Field>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(3)}>
            上一步
          </button>
        </div>
      ) : null}
    </div>
  );
}
