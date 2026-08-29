"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CastPicker } from "@/components/CastPicker";
import { Field } from "@/components/Field";
import { TagSelector } from "@/components/TagEditor";
import { boardCopy } from "@/lib/copy";
import {
  mergeIncomingOutlineChapter,
  outlineChapterDraftSnapshot,
  REMOVE_OUTLINE_CHAPTER_CONFIRM,
  retainPendingAfterIncoming,
} from "@/lib/outline-edit";
import type {
  Character,
  OutlineChapter,
  Volume,
} from "@/lib/types";

export function OutlineChapterDetail({
  chapter,
  written,
  volumeTitle,
  wordTarget,
  volumes,
  characters,
  tagLibrary,
  busy,
  onPatch,
  onWriteThisChapter,
  onViewManuscript,
  onAddSibling,
  onPolish,
  onRemove,
  onSelectVolume,
}: {
  chapter: OutlineChapter;
  written: boolean;
  volumeTitle: string;
  wordTarget: string;
  volumes: Volume[];
  characters: Character[];
  tagLibrary: string[];
  busy: string | null;
  onPatch: (chapterId: string, partial: Partial<OutlineChapter>) => void;
  onWriteThisChapter: (chapterId: string) => void;
  onViewManuscript: (chapterId: string) => void;
  onAddSibling: (afterId: string) => void;
  onPolish: (chapter: OutlineChapter) => void;
  onRemove: (chapterId: string) => void;
  onSelectVolume: (volumeId: string) => void;
}) {
  const [draft, setDraft] = useState(chapter);
  const [lastSynced, setLastSynced] = useState(chapter);
  const [pending, setPending] = useState<Partial<OutlineChapter>>({});
  const persistRef = useRef({
    chapterId: chapter.id,
    onPatch,
    pending: {} as Partial<OutlineChapter>,
    timer: null as ReturnType<typeof setTimeout> | null,
  });

  if (chapter.id !== lastSynced.id) {
    setLastSynced(chapter);
    setDraft(chapter);
    setPending({});
  } else if (
    outlineChapterDraftSnapshot(chapter) !==
    outlineChapterDraftSnapshot(lastSynced)
  ) {
    setDraft(mergeIncomingOutlineChapter(chapter, pending, lastSynced));
    setPending(retainPendingAfterIncoming(pending, chapter, lastSynced));
    setLastSynced(chapter);
  }

  function flush() {
    const bag = persistRef.current;
    if (bag.timer) {
      clearTimeout(bag.timer);
      bag.timer = null;
    }
    const payload = bag.pending;
    if (!Object.keys(payload).length) return;
    bag.pending = {};
    bag.onPatch(bag.chapterId, payload);
    setPending({});
  }

  useLayoutEffect(() => {
    persistRef.current.onPatch = onPatch;
    persistRef.current.chapterId = chapter.id;
    persistRef.current.pending = pending;
  }, [onPatch, chapter.id, pending]);

  useEffect(() => {
    const bag = persistRef.current;
    return () => {
      if (bag.timer) {
        clearTimeout(bag.timer);
        bag.timer = null;
      }
      if (Object.keys(bag.pending).length) {
        bag.onPatch(bag.chapterId, bag.pending);
      }
    };
  }, []);

  function edit(partial: Partial<OutlineChapter>) {
    persistRef.current.onPatch = onPatch;
    persistRef.current.chapterId = chapter.id;
    persistRef.current.pending = {
      ...persistRef.current.pending,
      ...partial,
    };
    setPending(persistRef.current.pending);
    setDraft((d) => ({ ...d, ...partial }));
    if (persistRef.current.timer) clearTimeout(persistRef.current.timer);
    persistRef.current.timer = setTimeout(flush, 200);
  }

  const outlineChars = draft.summary ? draft.summary.length : 0;

  return (
    <div className="card space-y-3">
      <div className="text-xs text-[var(--text-muted)]">
        <button
          type="button"
          className="btn btn-ghost btn-sm !px-1"
          onClick={() => {
            const vid = draft.volumeId || volumes[0]?.id;
            if (vid) onSelectVolume(vid);
          }}
        >
          {volumeTitle}
        </button>
        <span> / 第 {draft.order} 章</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="!flex-1 min-w-[10rem] !font-semibold !text-lg"
          value={draft.title}
          onChange={(e) => edit({ title: e.target.value })}
          onBlur={flush}
        />
        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-hover)]">
          {written ? "已写" : "待写"}
        </span>
      </div>
      <p className="text-sm text-[var(--text-muted)] m-0">
        大纲 {outlineChars} 字 · 正文目标 {wordTarget} 字
      </p>
      <div className="flex flex-wrap gap-2">
        {written ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              flush();
              onViewManuscript(chapter.id);
            }}
          >
            查看正文
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!!busy}
            onClick={() => {
              flush();
              onWriteThisChapter(chapter.id);
            }}
          >
            写这一章
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            flush();
            onAddSibling(chapter.id);
          }}
        >
          新增同级章
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!!busy}
          onClick={() => {
            flush();
            onPolish({ ...chapter, ...draft, ...persistRef.current.pending });
          }}
        >
          {busy === `polish:${chapter.id}` ? (
            <>
              <span className="spinner" /> 润色中
            </>
          ) : (
            "优化大纲"
          )}
        </button>
        {!written ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              flush();
              onViewManuscript(chapter.id);
            }}
          >
            查看正文
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (!confirm(REMOVE_OUTLINE_CHAPTER_CONFIRM)) return;
            flush();
            onRemove(chapter.id);
          }}
        >
          删除
        </button>
      </div>
      <Field label="剧情摘要">
        <textarea
          value={draft.summary}
          onChange={(e) => edit({ summary: e.target.value })}
          onBlur={flush}
          rows={8}
          className="!min-h-[10rem] w-full outline-field-lg"
        />
      </Field>
      {volumes.length > 1 ? (
        <Field label="所属卷">
          <select
            value={draft.volumeId || volumes[0]?.id}
            onChange={(e) => {
              edit({ volumeId: e.target.value });
              flush();
            }}
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
          value={draft.keyPoints}
          onChange={(e) => edit({ keyPoints: e.target.value })}
          onBlur={flush}
          rows={5}
          className="!min-h-[7rem] w-full outline-field-lg"
        />
      </Field>
      <Field label="章末钩子" hint="本章结尾要悬着的事；连载模式下会写入正文要求">
        <textarea
          value={draft.hook || ""}
          onChange={(e) => edit({ hook: e.target.value })}
          onBlur={flush}
          rows={2}
          className="w-full"
          placeholder="例如：门后那人还没回头"
        />
      </Field>
      <Field label={boardCopy().intensityLabel}>
        <textarea
          value={draft.intensityNote || draft.eroticNote || ""}
          onChange={(e) => edit({ intensityNote: e.target.value })}
          onBlur={flush}
          rows={5}
          className="!min-h-[7rem] w-full outline-field-lg"
        />
      </Field>
      <div className="mt-2">
        <TagSelector
          library={tagLibrary}
          selected={draft.tags || []}
          onChange={(tags) => edit({ tags })}
          label="本章标签"
          hint="叠加在本书标签之上；开写前建议先「优化大纲」"
        />
        <CastPicker
          characters={characters}
          castIds={draft.castIds}
          onChange={(castIds) => edit({ castIds })}
        />
      </div>
    </div>
  );
}
