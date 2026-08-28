"use client";

import { countChars } from "@/lib/progress";
import type { NovelProject } from "@/lib/types";

export function ChapterNavList({
  project,
  selectedId,
  onSelect,
}: {
  project: NovelProject;
  selectedId?: string | null;
  onSelect: (chapterId: string) => void;
}) {
  const chapters = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  if (!chapters.length) {
    return (
      <p className="text-xs text-[var(--text-muted)] px-2 py-1 m-0">还没有章节</p>
    );
  }
  return (
    <ul className="list-none p-0 m-0 overflow-y-auto flex-1 min-h-0">
      {chapters.map((ch) => {
        const row = project.chapters.find((c) => c.chapterId === ch.id);
        const words = countChars(row?.content || "");
        return (
          <li key={ch.id}>
            <button
              type="button"
              className={`studio-nav-sub ${selectedId === ch.id ? "active" : ""}`}
              onClick={() => onSelect(ch.id)}
            >
              <span className="block truncate">
                {words ? "✓ " : ""}第{ch.order} {ch.title || "未题"}
              </span>
              <span className="block text-[0.7rem] text-[var(--text-muted)]">
                {words ? `${words} 字` : "待写"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
