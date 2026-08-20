"use client";

import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card empty max-w-xl mx-auto">
      <p className="text-base font-medium text-[var(--text)] m-0 mb-2">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--text-muted)] m-0 mb-4 leading-relaxed">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
