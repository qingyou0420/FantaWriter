import type { ReactNode } from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
      {hint ? (
        <p className="text-[0.7rem] text-[var(--text-muted)] mt-1 mb-0 leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
