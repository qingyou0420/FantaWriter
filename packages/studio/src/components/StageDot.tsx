/**
 * Single stage-progress mark. Uses currentColor so page highlight and
 * stage state stay on separate visual axes.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { BookStepState } from "../lib/book-stage";

export function StageDot({
  state,
  title,
  className = "",
}: {
  readonly state: BookStepState;
  readonly title?: string;
  readonly className?: string;
}) {
  return (
    <span
      className={`stage-dot ${className}`.trim()}
      data-state={state}
      title={title}
      aria-hidden="true"
    />
  );
}

export function stageStateLabel(state: BookStepState, isZh: boolean, writeDone = false): string {
  if (writeDone && state === "done") return isZh ? "已完结" : "Finished";
  if (state === "done") return isZh ? "已完成" : "Done";
  if (state === "current") return isZh ? "进行中" : "In progress";
  if (state === "blocked") return isZh ? "被闸" : "Blocked";
  return isZh ? "未开始" : "Not started";
}
