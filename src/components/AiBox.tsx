"use client";

import type { ReactNode } from "react";

/** AI 帮写工具条：灵感输入 + 主/次按钮 */
export function AiBox({
  title,
  hint,
  seed,
  onSeedChange,
  seedPlaceholder = "",
  busy,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  extra,
}: {
  title: string;
  hint?: string;
  seed: string;
  onSeedChange: (v: string) => void;
  seedPlaceholder?: string;
  busy: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[rgba(196,92,138,0.35)] bg-[rgba(196,92,138,0.08)] p-3.5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="badge">AI 帮写</span>
          <span className="text-sm font-medium">{title}</span>
        </div>
        {extra}
      </div>
      {hint ? (
        <p className="text-[0.75rem] text-[var(--text-muted)] mt-0 mb-2 leading-relaxed">
          {hint}
        </p>
      ) : null}
      <textarea
        value={seed}
        onChange={(e) => onSeedChange(e.target.value)}
        placeholder={seedPlaceholder || undefined}
        rows={3}
        className="!bg-[var(--bg)]"
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2 mt-2.5">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={onPrimary}
        >
          {busy ? (
            <>
              <span className="spinner" /> 生成中…
            </>
          ) : (
            primaryLabel
          )}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
