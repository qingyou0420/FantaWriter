"use client";

import {
  listOpenThreadsWithoutDestination,
  listOverdueThreads,
  listUnreviewedChapters,
  needsConsistencyCheckup,
  remainingUnwrittenInVolume,
  volumeNearEnd,
} from "@/lib/daily-flow";
import { volumeIdForLatestWrittenChapter } from "@/lib/volumes";
import type { NovelProject } from "@/lib/types";

export function DailyStatusBar({
  project,
  onJumpUnreviewed,
  onJumpOverdue,
  onJumpCheckup,
  onJumpVolumeClose,
}: {
  project: NovelProject;
  onJumpUnreviewed: (chapterId: string) => void;
  onJumpOverdue?: () => void;
  onJumpCheckup?: () => void;
  onJumpVolumeClose?: (volumeId: string) => void;
}) {
  const unreviewed = listUnreviewedChapters(project);
  const overdue = listOverdueThreads(project);
  const checkup = needsConsistencyCheckup(project);
  const volId = volumeIdForLatestWrittenChapter(project);
  const nearEnd = volId ? volumeNearEnd(project, volId) : false;
  const openNoDest = listOpenThreadsWithoutDestination(project.plotThreads);
  const left = volId ? remainingUnwrittenInVolume(project, volId) : 0;

  if (!unreviewed.length && !overdue.length && !checkup && !nearEnd) {
    return null;
  }

  return (
    <div className="daily-status">
      {unreviewed.length ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onJumpUnreviewed(unreviewed[0].id)}
        >
          未审 {unreviewed.length} 章
        </button>
      ) : (
        <span>未审 0 章</span>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onJumpOverdue}
      >
        {overdue.length} 条伏笔悬置超期
      </button>
      {checkup ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onJumpCheckup}
        >
          该体检了（已审满 10 章）
        </button>
      ) : null}
      {nearEnd ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => volId && onJumpVolumeClose?.(volId)}
        >
          快到卷尾了：还有 {left} 章未写
          {openNoDest.length ? ` · ${openNoDest.length} 条伏笔未定去向` : ""}
        </button>
      ) : null}
    </div>
  );
}
