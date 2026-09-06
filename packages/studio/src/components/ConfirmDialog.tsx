import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly variant?: "danger" | "default";
  readonly children?: ReactNode;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "default",
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 fade-in-150"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div className="w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            {isDanger && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle size={20} className="text-destructive" />
              </div>
            )}
            <h3 className="font-serif text-[20px] font-medium leading-7">{title}</h3>
          </div>
        </div>

        <div className="px-6 py-4">
          {message ? <p className="text-sm leading-relaxed text-muted-foreground">{message}</p> : null}
          {children}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button type="button" onClick={onCancel} className="btn-ghost">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={isDanger ? "btn-danger" : "btn-primary"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
