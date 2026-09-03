/**
 * 织卷: rematerialize the remaining / full 卷→章 tree through the confirm gate.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { MAX_VOLUME_TREE_LABEL_CHARS, formatVolumeLabel, truncateOutlineLabel } from "./volume-map-tree";

export type OutlineWeaveMode = "remaining" | "full";

export function resolveOutlineWeaveMode(chapterCount: number): OutlineWeaveMode {
  return chapterCount > 0 ? "remaining" : "full";
}

export function outlineWeavePrompt(isZh: boolean, mode: OutlineWeaveMode): string {
  if (isZh) {
    return mode === "full"
      ? "按目标章数重织全书卷→章树（走确认闸，不删书）。"
      : "按目标章数补齐尚未落地的章级条目（走确认闸）。";
  }
  return mode === "full"
    ? "Rebuild the full volume→chapter tree from target length (confirm gate, do not delete the book)."
    : "Fill remaining chapter entries from target length (confirm gate).";
}

export function outlineTreeVolumeLabel(
  volumeNumber: number | null,
  title: string,
  isZh: boolean,
): string {
  return truncateOutlineLabel(formatVolumeLabel(volumeNumber, title, isZh), MAX_VOLUME_TREE_LABEL_CHARS);
}

export function outlineTreeHeadingTooLong(label: string): boolean {
  return label.length > MAX_VOLUME_TREE_LABEL_CHARS;
}
