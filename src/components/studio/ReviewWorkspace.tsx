"use client";

import { useMemo, useState } from "react";
import { locateEvidenceOffset, listReviewDimensions } from "@/lib/review-registry";
import type { ChapterReview, NovelProject, ReviewSeverity } from "@/lib/types";

export function ReviewWorkspace({
  project,
  selectedChapterId,
  onSelectChapter,
  onLocate,
  onReviewChapter,
  busy,
}: {
  project: NovelProject;
  selectedChapterId?: string | null;
  onSelectChapter: (id: string) => void;
  onLocate: (chapterId: string, offset: number) => void;
  onReviewChapter: (chapterId: string) => void;
  busy?: boolean;
}) {
  const [sev, setSev] = useState<"all" | ReviewSeverity>("all");
  const [dim, setDim] = useState("all");
  const dims = listReviewDimensions();
  const chapters = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  const selected =
    selectedChapterId && chapters.some((c) => c.id === selectedChapterId)
      ? selectedChapterId
      : chapters.find((c) =>
          project.chapters.some((r) => r.chapterId === c.id && r.content?.trim())
        )?.id || chapters[0]?.id;
  const reviews = (project.reviews || []).filter((r) => r.chapterId === selected);
  const latest: ChapterReview | undefined = reviews[0];
  const issues = (latest?.issues || []).filter((i) => {
    if (sev !== "all" && i.severity !== sev) return false;
    if (dim !== "all" && i.dimension !== dim) return false;
    return true;
  });
  const stats = useMemo(() => {
    const reviewed = project.chapters.filter(
      (c) => c.reviewState === "reviewed"
    ).length;
    const blocking = (project.reviews || []).reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === "high").length,
      0
    );
    const pending = project.chapters.filter(
      (c) => c.content?.trim() && c.reviewState !== "reviewed"
    ).length;
    return { reviewed, blocking, pending };
  }, [project]);

  return (
    <div className="flex-1 min-h-0 flex">
      <aside className="w-56 shrink-0 border-r border-[var(--border-soft)] overflow-y-auto p-2">
        <div className="text-xs text-[var(--text-muted)] px-2 py-1">
          已审 {stats.reviewed} · 阻断 {stats.blocking} · 待处理 {stats.pending}
        </div>
        {chapters.map((ch) => {
          const row = project.chapters.find((c) => c.chapterId === ch.id);
          const rev = (project.reviews || []).find((r) => r.chapterId === ch.id);
          const written = Boolean(row?.content?.trim());
          const label = !written
            ? "未写"
            : row?.reviewState === "reviewed"
              ? rev
                ? `${rev.score} 分`
                : "已审（旧流程）"
              : `${rev?.issues.length || 0} 问`;
          return (
            <button
              key={ch.id}
              type="button"
              className={`studio-tree-row ${selected === ch.id ? "active" : ""}`}
              onClick={() => onSelectChapter(ch.id)}
            >
              <span className="truncate">
                第{ch.order} {ch.title}
              </span>
              <span className="text-[0.7rem] text-[var(--text-muted)] ml-auto">
                {label}
              </span>
            </button>
          );
        })}
      </aside>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!!busy || !selected}
            onClick={() => selected && onReviewChapter(selected)}
          >
            审查当前章节
          </button>
          <select value={sev} onChange={(e) => setSev(e.target.value as typeof sev)}>
            <option value="all">全部严重度</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <select value={dim} onChange={(e) => setDim(e.target.value)}>
            <option value="all">全部维度</option>
            {dims.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        {latest ? (
          <p className="text-sm text-[var(--text-muted)] m-0">
            评分 {latest.score}
            {latest.skipped ? " · 已跳过" : ""}
            {latest.source === "legacy_consistency" ? " · 旧一致性记录" : ""}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)] m-0">
            本章还没有维度化审稿。旧流程标「已审」的章不会伪造分数。
          </p>
        )}
        {issues.map((iss, i) => {
          const dimLabel =
            dims.find((d) => d.id === iss.dimension)?.label || iss.dimension;
          const row = project.chapters.find((c) => c.chapterId === selected);
          const offset = locateEvidenceOffset(row?.content || "", iss.evidence);
          return (
            <div key={`${iss.title}-${i}`} className="card !py-3">
              <div className="flex flex-wrap gap-2 items-center">
                <strong>{iss.title}</strong>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-hover)]">
                  {iss.severity}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{dimLabel}</span>
              </div>
              <p className="text-sm m-0 mt-2">{iss.evidence || iss.suggestion}</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={offset < 0 || !selected}
                  onClick={() => selected && onLocate(selected, offset)}
                >
                  定位原文
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled
                  title="修订提案闸是 P1"
                >
                  生成修订提案
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
