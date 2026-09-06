/**
 * Default in-progress cover: title + started date + N/target progress.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { formatStartedOn } from "../lib/stage-copy";

export function DefaultCover({
  title,
  createdAt,
  written = 0,
  target = 0,
  coverSrc,
  compact = false,
}: {
  readonly title: string;
  readonly createdAt?: string;
  readonly written?: number;
  readonly target?: number;
  readonly coverSrc?: string;
  readonly compact?: boolean;
}) {
  const started = formatStartedOn(createdAt, true);
  const ratio = target > 0 ? Math.min(1, written / target) : 0;
  if (coverSrc) {
    return (
      <img
        src={coverSrc}
        alt={title}
        className={`w-full rounded-md object-cover border border-border/50 ${compact ? "aspect-[3/4]" : "aspect-[3/4]"}`}
      />
    );
  }
  return (
    <div
      className={`flex w-full flex-col justify-between rounded-md border border-border/60 bg-secondary/40 px-2 py-2 ${
        compact ? "aspect-[3/4]" : "aspect-[3/4]"
      }`}
      data-testid="default-cover"
    >
      <div className="font-serif text-[13px] leading-5 text-foreground line-clamp-3">{title}</div>
      <div className="space-y-1">
        {started && <div className="text-[10px] text-muted-foreground">{started}</div>}
        <div className="h-1 overflow-hidden rounded-full bg-border/70">
          <div className="h-full bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        <div className="text-[10px] tabular-nums text-muted-foreground">
          {written}/{target > 0 ? target : "—"}
        </div>
      </div>
    </div>
  );
}
