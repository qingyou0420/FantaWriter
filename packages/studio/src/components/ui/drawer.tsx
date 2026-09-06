/**
 * Right-side drawer: ESC, themed overlay, 420 width, 18px serif title.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Drawer({
  open,
  title,
  onClose,
  children,
  testId,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-foreground/20 fade-in-150"
      onClick={onClose}
      data-testid={testId}
    >
      <aside
        className="flex h-full w-full max-w-[420px] flex-col overflow-y-auto border-l border-border bg-card px-6 py-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-serif text-[18px] font-medium leading-[26px]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-lg"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </aside>
    </div>,
    document.body,
  );
}
