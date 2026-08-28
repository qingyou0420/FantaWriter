"use client";

import { PLANNER_AGENT_LABEL } from "@/lib/brand";
import type { CanonProposal } from "@/lib/canon-gate";

export function DiffConfirmGate({
  proposal,
  onConfirm,
  onReject,
  onEdit,
}: {
  proposal: CanonProposal;
  onConfirm: () => void;
  onReject: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/45">
      <div className="card max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        <div className="mb-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">
            {PLANNER_AGENT_LABEL} · 正典写入确认
          </div>
          <h2 className="text-lg font-semibold m-0">{proposal.summary}</h2>
          <p className="text-sm text-[var(--text-muted)] m-0 mt-1">
            确认后才会写入正典。模型口头宣称不算数。
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {proposal.changes.length ? (
            proposal.changes.map((c) => (
              <div key={c.path} className="border border-[var(--border-soft)] rounded-md p-2">
                <div className="text-xs text-[var(--text-muted)] mb-1">{c.label}</div>
                <div className="studio-diff text-sm">
                  <div>
                    <div className="text-[0.7rem] text-[var(--text-muted)]">旧值</div>
                    <pre className="whitespace-pre-wrap m-0 text-[0.8rem]">
                      {c.before || "（空）"}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[0.7rem] text-[var(--text-muted)]">新值</div>
                    <pre className="whitespace-pre-wrap m-0 text-[0.8rem]">
                      {c.after || "（空）"}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--text-muted)]">没有可对比的字段变化。</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 justify-end">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReject}>
            放弃
          </button>
          {onEdit ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              编辑后写入
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>
            确认写入
          </button>
        </div>
      </div>
    </div>
  );
}
