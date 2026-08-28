"use client";

import { useMemo, useState } from "react";
import {
  chapterMatchesTreeFilter,
  countTreeNodes,
  searchTreeLabel,
  type OutlineTreeFilter,
} from "@/lib/outline-tree";
import type { NovelProject, OutlineChapter } from "@/lib/types";

export function OutlineWorkspace({
  project,
  selectedId,
  onSelect,
  onAddSibling,
  onAddFirst,
  onCreateManuscript,
  onLocate,
  extra,
}: {
  project: NovelProject;
  selectedId?: string | null;
  onSelect: (chapterId: string) => void;
  onAddSibling: (afterId: string) => void;
  onAddFirst: () => void;
  onCreateManuscript: (chapterId: string) => void;
  onLocate: (chapterId: string) => void;
  extra?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<OutlineTreeFilter>("all");
  const tree = project.outlineTree || [];
  const chapters = project.outline?.chapters;
  const byId = useMemo(() => {
    const m = new Map<string, OutlineChapter>();
    for (const c of chapters || []) m.set(c.id, c);
    return m;
  }, [chapters]);
  const written = (id: string) =>
    Boolean(project.chapters.find((c) => c.chapterId === id)?.content?.trim());
  const counts = countTreeNodes(tree);
  const writtenCount = (chapters || []).filter((c) => written(c.id)).length;
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedWritten = selected ? written(selected.id) : false;
  const volTitle = (id: string) =>
    project.volumes?.find((v) => v.id === id)?.title || "卷";

  return (
    <div className="flex-1 min-h-0 flex">
      <aside className="w-72 shrink-0 border-r border-[var(--border-soft)] flex flex-col min-h-0">
        <div className="p-2 text-xs text-[var(--text-muted)]">
          {counts.volumes} 卷 · {counts.acts} 幕 · {counts.sections} 节 ·{" "}
          {counts.chapters} 章 · {writtenCount} 已写
        </div>
        <div className="px-2 pb-2 flex gap-1">
          <input
            className="flex-1"
            placeholder="搜索节点"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="px-2 pb-2 flex gap-1">
          {(["all", "unwritten", "written"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`btn btn-ghost btn-sm ${filter === id ? "btn-secondary" : ""}`}
              onClick={() => setFilter(id)}
            >
              {id === "all" ? "全部" : id === "unwritten" ? "待写" : "已写"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
          {tree.map((vol) => (
            <div key={vol.id} className="mb-2">
              <div className="text-xs font-medium px-2 py-1">{volTitle(vol.id)}</div>
              {vol.acts.map((act) => (
                <div key={act.id} className="pl-2">
                  <div className="text-xs text-[var(--text-muted)] px-2">
                    {act.title || "幕"}
                  </div>
                  {act.sections.map((sec) => (
                    <div key={sec.id} className="pl-2">
                      <div className="text-xs text-[var(--text-muted)] px-2">
                        {sec.title || "节"}
                      </div>
                      {sec.chapters.map((ref) => {
                        const ch = byId.get(ref.chapterId);
                        if (!ch) return null;
                        const isWritten = written(ch.id);
                        if (!chapterMatchesTreeFilter(isWritten, filter)) return null;
                        const label = `第${ch.order}章 ${ch.title}`;
                        if (!searchTreeLabel(label, q)) return null;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            className={`studio-tree-row ${selectedId === ch.id ? "active" : ""}`}
                            onClick={() => onSelect(ch.id)}
                          >
                            <span>{isWritten ? "✓" : "○"}</span>
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {selected ? (
          <div className="card space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold m-0">
                第 {selected.order} 章 · {selected.title}
              </h2>
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-hover)]">
                {selectedWritten ? "已写" : "待写"}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] m-0">
              大纲 {selected.summary ? selected.summary.length : 0} 字 · 目标见生成参数
            </p>
            <p className="text-sm whitespace-pre-wrap m-0">
              {selected.summary || "（无大纲摘要）"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onAddSibling(selected.id)}
              >
                新增同级章
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onCreateManuscript(selected.id)}
              >
                用此章创建正文
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onLocate(selected.id)}
              >
                原文定位
              </button>
            </div>
          </div>
        ) : (
          <div className="card space-y-2">
            <p className="text-sm text-[var(--text-muted)] m-0">
              {counts.chapters === 0
                ? "还没有章节点。可以先手工占一章，再让织卷起草或直接写。"
                : "从左侧选一个章节点。"}
            </p>
            {counts.chapters === 0 ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onAddFirst}
              >
                新增第一章
              </button>
            ) : null}
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}
