"use client";

import { useMemo, useState } from "react";
import type { NovelProject } from "@/lib/types";

export type GlobalReplaceHit = {
  chapterId: string;
  order: number;
  title: string;
  count: number;
};

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while (true) {
    const j = hay.indexOf(needle, i);
    if (j < 0) break;
    n++;
    i = j + needle.length;
  }
  return n;
}

export function GlobalFindReplace({
  project,
  onReplace,
}: {
  project: NovelProject;
  /** 对命中章节应用替换后的正文 */
  onReplace: (
    updates: { chapterId: string; content: string }[]
  ) => void;
}) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [hint, setHint] = useState("");

  const chapters = useMemo(() => {
    const outline = project.outline?.chapters
      ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
      : [];
    return outline.map((ch) => {
      const body =
        project.chapters.find((c) => c.chapterId === ch.id)?.content || "";
      return { id: ch.id, order: ch.order, title: ch.title, content: body };
    });
  }, [project]);

  const hits: GlobalReplaceHit[] = useMemo(() => {
    const q = find;
    if (!q) return [];
    return chapters
      .map((ch) => ({
        chapterId: ch.id,
        order: ch.order,
        title: ch.title,
        count: countOccurrences(ch.content, q),
      }))
      .filter((h) => h.count > 0);
  }, [chapters, find]);

  const totalHits = hits.reduce((n, h) => n + h.count, 0);

  function doReplaceAll() {
    if (!find) {
      setHint("请输入查找内容");
      return;
    }
    if (!hits.length) {
      setHint("未找到匹配");
      return;
    }
    if (
      !confirm(
        `将在 ${hits.length} 章中替换共 ${totalHits} 处「${find}」→「${replace}」，是否继续？`
      )
    ) {
      return;
    }
    const updates = chapters
      .filter((ch) => ch.content.includes(find))
      .map((ch) => ({
        chapterId: ch.id,
        content: ch.content.split(find).join(replace),
      }));
    onReplace(updates);
    setHint(`已替换 ${totalHits} 处，涉及 ${updates.length} 章`);
  }

  return (
    <div className="card">
      <h2 className="text-base font-semibold m-0 mb-1">全书查找替换</h2>
      <p className="text-xs text-[var(--text-muted)] mt-0 mb-3">
        跨章节统一改名、统一称谓（字面匹配，区分大小写）。替换会写入正文并自动保存。
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-2">
        <div>
          <label className="field-label">查找</label>
          <input
            value={find}
            onChange={(e) => {
              setFind(e.target.value);
              setHint("");
            }}
            placeholder="要查找的文字"
          />
        </div>
        <div>
          <label className="field-label">替换为</label>
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="可为空（等于删除）"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!find}
          onClick={doReplaceAll}
        >
          全部替换
        </button>
        <span className="text-xs text-[var(--text-muted)]">
          {find
            ? totalHits
              ? `找到 ${totalHits} 处 · ${hits.length} 章`
              : "无匹配"
            : "输入后显示命中统计"}
        </span>
      </div>
      {hint ? (
        <p className="text-xs text-[var(--accent)] m-0 mb-2">{hint}</p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="list-none p-0 m-0 max-h-40 overflow-y-auto space-y-1 text-sm">
          {hits.map((h) => (
            <li
              key={h.chapterId}
              className="flex justify-between gap-2 py-1 px-2 rounded-lg hover:bg-[var(--bg-hover)]"
            >
              <span className="truncate">
                第{h.order}章 {h.title}
              </span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {h.count} 处
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
