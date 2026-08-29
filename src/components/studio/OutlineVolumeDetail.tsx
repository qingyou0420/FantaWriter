"use client";

import type { ReactNode } from "react";
import { Field } from "@/components/Field";
import type { Volume } from "@/lib/types";

export function OutlineVolumeDetail({
  volume,
  chapterCount,
  busy,
  summaryDraft,
  wizard,
  onPatch,
  onGenerateSummary,
  onOpenCloseWizard,
  onSaveSummaryDraft,
  onDiscardSummaryDraft,
  onEditSummaryDraft,
}: {
  volume: Volume;
  chapterCount: number;
  busy: string | null;
  summaryDraft?: { volumeId: string; text: string } | null;
  wizard?: ReactNode;
  onPatch: (volumeId: string, partial: Partial<Volume>) => void;
  onGenerateSummary: (volumeId: string) => void;
  onOpenCloseWizard: (volumeId: string) => void;
  onSaveSummaryDraft?: () => void;
  onDiscardSummaryDraft?: () => void;
  onEditSummaryDraft?: (text: string) => void;
}) {
  const draftOpen = summaryDraft?.volumeId === volume.id;

  return (
    <div className="card space-y-3">
      <div className="text-xs text-[var(--text-muted)]">卷</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="!flex-1 min-w-[10rem] !font-semibold !text-lg"
          value={volume.title}
          onChange={(e) => onPatch(volume.id, { title: e.target.value })}
        />
        <span className="badge">{chapterCount} 章</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!!busy}
          onClick={() => onGenerateSummary(volume.id)}
        >
          {busy === `volume_summary:${volume.id}` ? (
            <>
              <span className="spinner" /> 摘要…
            </>
          ) : (
            "AI 生成本卷摘要"
          )}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onOpenCloseWizard(volume.id)}
        >
          过卷向导
        </button>
      </div>
      {draftOpen ? (
        <div className="space-y-2">
          <Field label="本卷摘要（草稿）">
            <textarea
              rows={4}
              value={summaryDraft?.text || ""}
              onChange={(e) => onEditSummaryDraft?.(e.target.value)}
            />
          </Field>
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
        <Field label="本卷摘要">
          <textarea
            rows={3}
            placeholder="本卷摘要（可选）"
            value={volume.summary}
            onChange={(e) => onPatch(volume.id, { summary: e.target.value })}
          />
        </Field>
      )}
      <Field label="弧线目标">
        <textarea
          rows={2}
          placeholder="本卷弧线目标（可选）"
          value={volume.arcGoal || ""}
          onChange={(e) => onPatch(volume.id, { arcGoal: e.target.value })}
        />
      </Field>
      <Field label="出卷局面">
        <textarea
          rows={2}
          placeholder="出卷局面（可选）"
          value={volume.exitState || ""}
          onChange={(e) => onPatch(volume.id, { exitState: e.target.value })}
        />
      </Field>
      {wizard}
    </div>
  );
}
