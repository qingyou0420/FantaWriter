"use client";

import { useMemo, useState } from "react";
import {
  collectReplaceReminders,
  countOccurrences,
  type GlobalReplaceOptions,
} from "@/lib/find-replace";
import type { NovelProject } from "@/lib/types";

export type GlobalReplaceHit = {
  chapterId: string;
  order: number;
  title: string;
  count: number;
};

export function GlobalFindReplace({
  project,
  onReplace,
}: {
  project: NovelProject;
  onReplace: (
    find: string,
    replace: string,
    opts: GlobalReplaceOptions
  ) => void;
}) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [hint, setHint] = useState("");
  const [replaceSummaries, setReplaceSummaries] = useState(false);
  const [replaceOutline, setReplaceOutline] = useState(false);

  const chapters = useMemo(() => {
    const outline = project.outline?.chapters
      ? [...project.outline.chapters].sort((a, b) => a.order - b.order)
      : [];
    return outline.map((ch) => {
      const row = project.chapters.find((c) => c.chapterId === ch.id);
      return {
        id: ch.id,
        order: ch.order,
        title: ch.title,
        content: row?.content || "",
        summary: row?.summary || "",
      };
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
        count:
          countOccurrences(ch.content, q) +
          (replaceSummaries ? countOccurrences(ch.summary, q) : 0),
      }))
      .filter((h) => h.count > 0);
  }, [chapters, find, replaceSummaries]);

  const totalHits = hits.reduce((n, h) => n + h.count, 0);
  const reminders = useMemo(
    () => collectReplaceReminders(project, find),
    [project, find]
  );

  function doReplaceAll() {
    if (!find) {
      setHint("请输入查找内容");
      return;
    }
    if (!hits.length && !replaceOutline) {
      setHint("未找到匹配");
      return;
    }
    if (
      !confirm(
        `将替换「${find}」→「${replace}」${hits.length ? `（${hits.length} 章 / ${totalHits} 处正文${replaceSummaries ? "+摘要" : ""}）` : ""}${replaceOutline ? "，并改大纲标题/摘要/关键点" : ""}，是否继续？`
      )
    ) {
      return;
    }
    onReplace(find, replace, { replaceSummaries, replaceOutline });
    setHint(
      `已替换${totalHits ? ` ${totalHits} 处` : ""}${replaceOutline ? "，并已改大纲" : ""}`
    );
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
      <label className="flex items-start gap-2 text-sm text-[var(--text-muted)] mb-2 cursor-pointer">
        <input
          type="checkbox"
          className="!w-auto mt-0.5"
          checked={replaceSummaries}
          onChange={(e) => setReplaceSummaries(e.target.checked)}
        />
        <span>同时替换章节摘要</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-[var(--text-muted)] mb-2 cursor-pointer">
        <input
          type="checkbox"
          className="!w-auto mt-0.5"
          checked={replaceOutline}
          onChange={(e) => setReplaceOutline(e.target.checked)}
        />
        <span>同时替换大纲（标题/摘要/关键点）</span>
      </label>
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
      {reminders.length ? (
        <p className="text-xs text-[var(--warning)] m-0 mb-2">
          人物卡/伏笔中也有旧名，请手动改：
          {reminders.map((r) => `${r.kind === "character" ? "人物" : "伏笔"}「${r.label}」`).join("、")}
        </p>
      ) : null}
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
