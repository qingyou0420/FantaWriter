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
  readonly action: string;
  readonly onAction: () => void;
  readonly testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-start gap-4 rounded-xl border border-border/60 bg-card px-6 py-8"
      data-testid={testId ?? "literary-empty"}
    >
      <div className="space-y-2">
        <h2 className="font-serif text-[28px]">{title}</h2>
        {subtitle ? <p className="text-[15px] leading-7 text-muted-foreground">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        {action}
      </button>
    </div>
  );
}
