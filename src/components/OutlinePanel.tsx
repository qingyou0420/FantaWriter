"use client";

import { useMemo, useState } from "react";
import { CastPicker } from "@/components/CastPicker";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/Field";
import { TagSelector } from "@/components/TagEditor";
import { boardCopy } from "@/lib/copy";
import { insertChapterAfter } from "@/lib/volumes";
import type {
  Character,
  Outline,
  OutlineChapter,
  Volume,
  WritingBoard,
} from "@/lib/types";

export function OutlinePanel({
  outline,
  projectTags,
  library,
  writingBoard = "general",
  volumes,
  characters,
  busy,
  hideRollingOutline,
  planChapterCount = 10,
  onGenerate,
  onGenerateNext,
  onChange,
  onGenerateChapter,
  onPolishChapter,
}: {
  outline: Outline | null;
  projectTags: string[];
  library: string[];
  writingBoard?: WritingBoard;
  volumes?: Volume[];
  characters?: Character[];
  busy: string | null;
  hideRollingOutline?: boolean;
  planChapterCount?: number;
  onGenerate: () => void;
  onGenerateNext?: (volumeId: string, chapterCount: number) => void;
  onChange: (o: Outline) => void;
  onGenerateChapter: (ch: OutlineChapter) => void;
  onPolishChapter: (ch: OutlineChapter) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      outline
        ? [...outline.chapters].sort((a, b) => a.order - b.order)
        : [],
    [outline]
  );

  const resolvedActiveId =
    !sorted.length
      ? null
      : activeId && sorted.some((c) => c.id === activeId)
        ? activeId
        : sorted[0].id;

  if (!outline) {
    return (
      <EmptyState
        title="尚未生成大纲"
        description={boardCopy(writingBoard).outlineEmpty}
        action={
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!busy}
            onClick={onGenerate}
          >
            {busy === "outline" ? (
              <>
                <span className="spinner" /> 生成中…
              </>
            ) : (
              "AI 生成大纲"
            )}
          </button>
        }
      />
    );
  }

  function patchChapter(id: string, partial: Partial<OutlineChapter>) {
    onChange({
      ...outline!,
      chapters: outline!.chapters.map((c) =>
        c.id === id ? { ...c, ...partial } : c
      ),
    });
  }

  function insertAfter(afterId: string) {
    const after = outline!.chapters.find((c) => c.id === afterId);
    const ch: OutlineChapter = {
      id: crypto.randomUUID(),
      order: 0,
      title: "新章",
      summary: "",
      keyPoints: "",
      tags: [],
      hook: "",
      volumeId: after?.volumeId,
    };
    onChange({
      ...outline!,
      chapters: insertChapterAfter(outline!.chapters, afterId, ch),
    });
    setActiveId(ch.id);
  }

  function addChapter() {
    const order =
      outline!.chapters.reduce((m, c) => Math.max(m, c.order), 0) + 1;
    const sortedVols = volumes
      ? [...volumes].sort((a, b) => a.order - b.order)
      : [];
    const volId = sortedVols.length
      ? sortedVols[sortedVols.length - 1].id
      : undefined;
    const ch: OutlineChapter = {
      id: crypto.randomUUID(),
      order,
      title: `第 ${order} 章`,
      summary: "",
      keyPoints: "",
      tags: [],
      volumeId: volId,
    };
    onChange({ ...outline!, chapters: [...outline!.chapters, ch] });
    setActiveId(ch.id);
  }

  function removeChapter(id: string) {
    if (!confirm("删除该章大纲？对应正文也会丢失关联。")) return;
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    const nextChapters = outline!.chapters
      .filter((c) => c.id !== id)
      .map((c, i) => ({ ...c, order: i + 1 }));
    onChange({
      ...outline!,
      chapters: nextChapters,
    });
    if (resolvedActiveId === id) {
      setActiveId(nextChapters[0]?.id ?? null);
    }
  }

  function moveChapter(id: string, dir: -1 | 1) {
    const list = [...outline!.chapters].sort((a, b) => a.order - b.order);
    const idx = list.findIndex((c) => c.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    onChange({
      ...outline!,
      chapters: list.map((c, i) => ({ ...c, order: i + 1 })),
    });
  }

  function reorderByDrag(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...outline!.chapters].sort((a, b) => a.order - b.order);
    const from = list.findIndex((c) => c.id === fromId);
    const to = list.findIndex((c) => c.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    onChange({
      ...outline!,
      chapters: list.map((c, i) => ({ ...c, order: i + 1 })),
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAll() {
    setSelected(new Set(outline!.chapters.map((c) => c.id)));
  }

  function clearSelect() {
    setSelected(new Set());
  }

  function applyBatchTags(tags: string[], mode: "set" | "add" | "remove") {
    if (!selected.size) return;
    onChange({
      ...outline!,
      chapters: outline!.chapters.map((c) => {
        if (!selected.has(c.id)) return c;
        const cur = c.tags || [];
        if (mode === "set") return { ...c, tags };
        if (mode === "add") {
          const seen = new Set(cur);
          const next = [...cur];
          for (const t of tags) {
            if (!seen.has(t)) {
              seen.add(t);
              next.push(t);
            }
          }
          return { ...c, tags: next };
        }
        const drop = new Set(tags);
        return { ...c, tags: cur.filter((t) => !drop.has(t)) };
      }),
    });
  }

  const active = sorted.find((c) => c.id === resolvedActiveId) || null;
  const batchSelectedTags =
    selected.size === 1
      ? sorted.find((c) => selected.has(c.id))?.tags || []
      : [];

  function renderTocItem(ch: OutlineChapter) {
    const isOver = dragOverId === ch.id && dragId !== ch.id;
    const isDragging = dragId === ch.id;
    const isActive = resolvedActiveId === ch.id;
    return (
      <li
        key={ch.id}
        className={`outline-toc-item ${isActive ? "active" : ""} ${
          isOver ? "outline-drag-over" : ""
        } ${isDragging ? "outline-dragging" : ""} ${
          selected.has(ch.id) ? "selected" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverId !== ch.id) setDragOverId(ch.id);
        }}
        onDragLeave={() => {
          if (dragOverId === ch.id) setDragOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from =
            e.dataTransfer.getData("text/chapter-id") || dragId || "";
          setDragOverId(null);
          setDragId(null);
          if (from) reorderByDrag(from, ch.id);
        }}
      >
        <span
          className="outline-drag-handle"
          draggable
          title="拖拽排序"
          onDragStart={(e) => {
            setDragId(ch.id);
            e.dataTransfer.setData("text/chapter-id", ch.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDragId(null);
            setDragOverId(null);
          }}
        >
          ⠿
        </span>
        <label
          className="inline-flex items-center shrink-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected.has(ch.id)}
            onChange={() => toggleSelect(ch.id)}
            className="!w-auto"
          />
        </label>
        <button
          type="button"
          className="outline-toc-btn"
          onClick={() => setActiveId(ch.id)}
        >
          <span className="outline-toc-order">第 {ch.order} 章</span>
          <span className="outline-toc-title">{ch.title || "未命名"}</span>
          {ch.summary ? (
            <span className="outline-toc-preview">{ch.summary}</span>
          ) : null}
        </button>
      </li>
    );
  }

  return (
    <div className="space-y-4 outline-workspace">
      {/* 总览 */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-semibold m-0">大纲总览</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!!busy}
              onClick={onGenerate}
            >
              重新生成大纲
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addChapter}
            >
              + 添加章节
            </button>
            {!hideRollingOutline && onGenerateNext ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!!busy}
                onClick={() => {
                  const volId =
                    active?.volumeId ||
                    (volumes && volumes.length
                      ? [...volumes].sort((a, b) => a.order - b.order)[
                          volumes.length - 1
                        ]?.id
                      : "") ||
                    "";
                  if (!volId) return;
                  onGenerateNext(
                    volId,
                    Math.max(1, Math.min(20, planChapterCount || 10))
                  );
                }}
              >
                {busy === "outline_next" ? (
                  <>
                    <span className="spinner" /> 续排中…
                  </>
                ) : (
                  `续排本卷 ${Math.max(1, Math.min(20, planChapterCount || 10))} 章`
                )}
              </button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
          左侧选章编辑；拖拽把手排序；勾选多章可批量改标签。单章：标签 → 优化大纲 →
          生成本章。
        </p>
        {projectTags.length > 0 ? (
          <p className="text-xs text-[var(--text-muted)] mt-0 mb-3">
            {boardCopy(writingBoard).tagsTitle}：
            <span className="text-[var(--accent-text)]">
              {projectTags.join("、")}
            </span>
          </p>
        ) : null}
        <Field label="故事前提">
          <textarea
            value={outline.premise}
            onChange={(e) => onChange({ ...outline, premise: e.target.value })}
            rows={4}
            className="!min-h-[6rem] w-full"
          />
        </Field>
        <Field label="结局走向">
          <textarea
            value={outline.endingNote}
            onChange={(e) =>
              onChange({ ...outline, endingNote: e.target.value })
            }
            rows={3}
            className="!min-h-[5rem] w-full"
          />
        </Field>
      </div>

      {/* 批量标签 */}
      <div className="card border-[var(--accent)]/30">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold m-0">
            批量标签
            {selected.size ? (
              <span className="text-[var(--text-muted)] font-normal ml-2">
                已选 {selected.size} 章
              </span>
            ) : (
              <span className="text-[var(--text-muted)] font-normal ml-2">
                勾选左侧章节后操作
              </span>
            )}
          </h3>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={selectAll}
            >
              全选
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearSelect}
              disabled={!selected.size}
            >
              清空
            </button>
          </div>
        </div>
        <TagSelector
          library={library}
          selected={batchSelectedTags}
          onChange={(tags) => {
            if (!selected.size) return;
            applyBatchTags(tags, selected.size === 1 ? "set" : "add");
          }}
          label={
            selected.size === 1
              ? "设置该章标签"
              : "点击标签追加到选中章（多选时为追加）"
          }
          hint={
            selected.size > 1
              ? "多选模式下点击标签会追加；需要覆盖请逐章编辑或先清空再设"
              : undefined
          }
        />
        {selected.size > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (!confirm("清空所选章节的全部标签？")) return;
                applyBatchTags([], "set");
              }}
            >
              清空所选章标签
            </button>
          </div>
        ) : null}
      </div>

      {/* 双栏：目录 + 编辑 */}
      <div className="outline-split">
        <aside className="card outline-toc !p-2">
          <div className="px-2 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            章节目录 · {sorted.length}
          </div>
          <ul className="list-none p-0 m-0 space-y-0.5 max-h-[min(70vh,40rem)] overflow-y-auto">
            {(volumes || []).length > 1
              ? [...(volumes || [])]
                  .sort((a, b) => a.order - b.order)
                  .map((vol) => {
                    const fallbackId = [...(volumes || [])].sort(
                      (a, b) => a.order - b.order
                    )[0]?.id;
                    const items = sorted.filter(
                      (c) => (c.volumeId || fallbackId) === vol.id
                    );
                    return (
                      <li key={vol.id}>
                        <div className="text-xs font-medium text-[var(--text-muted)] px-2 py-1">
                          {vol.title}
                        </div>
                        <ul className="list-none p-0 m-0 space-y-0.5">
                          {items.map((ch) => renderTocItem(ch))}
                        </ul>
                      </li>
                    );
                  })
              : sorted.map((ch) => renderTocItem(ch))}
          </ul>
        </aside>

        <div className="card outline-editor min-w-0">
          {active ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="badge">第 {active.order} 章</span>
                <input
                  className="!flex-1 min-w-[10rem] !font-semibold"
                  value={active.title}
                  onChange={(e) =>
                    patchChapter(active.id, { title: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => moveChapter(active.id, -1)}
                  title="上移"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => moveChapter(active.id, 1)}
                  title="下移"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!!busy}
                  onClick={() => onPolishChapter(active)}
                  title="基于当前摘要/关键点与其它章连贯润色；若大改主线请同步改关键点与前后章"
                >
                  {busy === `polish:${active.id}` ? (
                    <>
                      <span className="spinner" /> 润色中
                    </>
                  ) : (
                    "优化大纲"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!!busy}
                  onClick={() => onGenerateChapter(active)}
                >
                  {busy === `chapter:${active.id}` ? (
                    <>
                      <span className="spinner" /> 生成中
                    </>
                  ) : (
                    "生成本章"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => insertAfter(active.id)}
                >
                  在本章后插入
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeChapter(active.id)}
                >
                  删除
                </button>
              </div>

              <Field label="剧情摘要">
                <textarea
                  value={active.summary}
                  onChange={(e) =>
                    patchChapter(active.id, { summary: e.target.value })
                  }
                  rows={8}
                  className="!min-h-[10rem] w-full outline-field-lg"
                />
              </Field>
              {volumes && volumes.length > 1 ? (
                <Field label="所属卷">
                  <select
                    value={
                      active.volumeId ||
                      [...volumes].sort((a, b) => a.order - b.order)[0]?.id
                    }
                    onChange={(e) =>
                      patchChapter(active.id, { volumeId: e.target.value })
                    }
                  >
                    {[...volumes]
                      .sort((a, b) => a.order - b.order)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : null}
              <Field label="关键情节点">
                <textarea
                  value={active.keyPoints}
                  onChange={(e) =>
                    patchChapter(active.id, { keyPoints: e.target.value })
                  }
                  rows={5}
                  className="!min-h-[7rem] w-full outline-field-lg"
                />
              </Field>
              <Field
                label="章末钩子"
                hint="本章结尾要悬着的事；连载模式下会写入正文要求"
              >
                <textarea
                  value={active.hook || ""}
                  onChange={(e) =>
                    patchChapter(active.id, { hook: e.target.value })
                  }
                  rows={2}
                  className="w-full"
                  placeholder="例如：门后那人还没回头"
                />
              </Field>
              <Field label={boardCopy(writingBoard).intensityLabel}>
                <textarea
                  value={active.intensityNote || active.eroticNote || ""}
                  onChange={(e) =>
                    patchChapter(active.id, {
                      intensityNote: e.target.value,
                    })
                  }
                  rows={5}
                  className="!min-h-[7rem] w-full outline-field-lg"
                />
              </Field>
              <div className="mt-2">
                <TagSelector
                  library={library}
                  selected={active.tags || []}
                  onChange={(tags) => patchChapter(active.id, { tags })}
                  label="本章标签"
                  hint="叠加在本书标签之上；生成本章前建议先「优化大纲」"
                />
                <CastPicker
                  characters={characters || []}
                  castIds={active.castIds}
                  onChange={(castIds) => patchChapter(active.id, { castIds })}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)] m-0 empty">
              请从左侧选择章节
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
