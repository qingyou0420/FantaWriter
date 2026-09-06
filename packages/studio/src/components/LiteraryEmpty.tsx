/**
 * Literary empty state: one sentence + one next CTA.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function LiteraryEmpty({
  title,
  subtitle,
  action,
  onAction,
  testId,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: string;
  readonly onAction?: () => void;
  readonly testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-start gap-4 py-12"
      data-testid={testId ?? "literary-empty"}
    >
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-medium leading-8">{title}</h2>
        {subtitle ? <p className="text-[15px] leading-7 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="btn-primary">
          {action}
        </button>
      ) : null}
    </div>
  );
}
