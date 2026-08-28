"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/Field";
import {
  buildPreviousContext,
  formatPlotThreadsForPrompt,
  streamGenerate,
} from "@/lib/api";
import {
  buildBeatContract,
  formatBeatContract,
  missingVerbatimAnchors,
  proposeBeatDeltas,
  type BeatCommitDeltas,
} from "@/lib/beat-contract";
import { attachOriginalContext } from "@/lib/original";
import { chapterAssembleExtras } from "@/lib/chapter-contract";
import type { ChapterPersistResult } from "@/lib/renewal";
import type {
  ChapterContent,
  ChapterScene,
  NovelProject,
  OutlineChapter,
} from "@/lib/types";

const STATUS_LABEL: Record<NonNullable<ChapterScene["status"]>, string> = {
  pending: "待扩写",
  accepted: "已接受",
  skipped: "已跳过",
};

export function BeatWorkbench({
  project,
  outlineChapter,
  chapter,
  busy,
  onBusy,
  onError,
  onUpdateScenes,
  onAppendContent,
  onCommitDeltas,
}: {
  project: NovelProject;
  outlineChapter: OutlineChapter;
  chapter: ChapterContent | null;
  busy: string | null;
  onBusy: (v: string | null) => void;
  onError: (msg: string) => void;
  onUpdateScenes: (scenes: ChapterScene[]) => void;
  onAppendContent: (
    content: string,
    opts?: { forceCanon?: boolean }
  ) => ChapterPersistResult | void;
  onCommitDeltas: (deltas: BeatCommitDeltas) => void;
}) {
  const scenes = useMemo(
    () => [...(chapter?.scenes || [])].sort((a, b) => a.order - b.order),
    [chapter?.scenes]
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    scenes.find((s) => s.status !== "accepted" && s.status !== "skipped")?.id ||
      scenes[0]?.id ||
      null
  );
  const [preview, setPreview] = useState("");
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
  const [deltaDraft, setDeltaDraft] = useState<BeatCommitDeltas | null>(null);
  const [anchorWarn, setAnchorWarn] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);

  const selected = scenes.find((s) => s.id === selectedId) || null;

  function patchScene(id: string, partial: Partial<ChapterScene>) {
    onUpdateScenes(scenes.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  }

  async function draftBeat(scene: ChapterScene) {
    onError("");
    setBlocked([]);
    setAnchorWarn([]);
    setDeltaDraft(null);
    onBusy(`beat:${scene.id}`);
    setPreviewSceneId(scene.id);
    setPreview("");
    try {
      const prior = buildPreviousContext(project, outlineChapter.order);
      const contract = buildBeatContract({
        canon: project.canon,
        threads: project.plotThreads,
        scene,
      });
      const assembledSoFar = (chapter?.content || "").trim();
      const text = await streamGenerate(
        attachOriginalContext(project, {
          mode: "scene_chapter",
          writingBoard: project.writingBoard,
          characters: project.characters,
          background: project.background,
          settings: project.settings,
          chapter: outlineChapter,
          scene: {
            order: scene.order,
            title: scene.title,
            summary: scene.summary,
            verbatimAnchors: scene.verbatimAnchors || [],
          },
          previousScenesText: assembledSoFar,
          previousChapterSnippet: prior.previousSnippet,
          previousSummaries: prior.previousSummaries,
          characterStateCard: prior.characterStateCard,
          priorBlock: prior.priorBlock,
          projectTags: project.tags || [],
          plotThreads:
            prior.plotThreads ||
            formatPlotThreadsForPrompt(project.plotThreads),
          lore: prior.lore,
          beatContractBlock: formatBeatContract(contract, project.plotThreads),
          ...chapterAssembleExtras(project, outlineChapter),
        }),
        {
          onDelta: (_d, full) => setPreview(full),
        }
      );
      setPreview(text);
      setAnchorWarn(missingVerbatimAnchors(text, scene.verbatimAnchors));
      setDeltaDraft(
        proposeBeatDeltas({
          draft: text,
          scene,
          threads: project.plotThreads,
        })
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      onBusy(null);
    }
  }

  function acceptBeat(force = false) {
    if (!selected || previewSceneId !== selected.id || !preview.trim()) return;
    const result = onAppendContent(preview.trim(), { forceCanon: force });
    if (result && !result.ok) {
      setBlocked(result.violations);
      onError("与锁定设定冲突，正文未写入。可改稿、重生成，或强制保存并警告。");
      return;
    }
    patchScene(selected.id, { status: "accepted" });
    setBlocked([]);
    setAnchorWarn([]);
    setPreview("");
    setPreviewSceneId(null);
    const next = scenes.find(
      (s) =>
        s.id !== selected.id &&
        s.status !== "accepted" &&
        s.status !== "skipped"
    );
    if (next) setSelectedId(next.id);
  }

  function skipBeat() {
    if (!selected) return;
    patchScene(selected.id, { status: "skipped" });
    setPreview("");
    setPreviewSceneId(null);
    setDeltaDraft(null);
    setBlocked([]);
  }

  function confirmDeltas() {
    if (!deltaDraft) return;
    onCommitDeltas(deltaDraft);
    setDeltaDraft(null);
  }

  if (!scenes.length) {
    return (
      <div className="card !p-4">
        <h3 className="text-sm font-medium m-0 mb-1">按拍扩写</h3>
        <p className="text-sm text-[var(--text-muted)] mt-0 mb-0">
          本章还没有节拍。请先在原作页写入骨架，或用「AI 规划场景」拆拍。
        </p>
      </div>
    );
  }

  return (
    <div className="card !p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium m-0 mb-1">按拍扩写</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0 mb-0">
          选一拍生成预览，确认后才写入本章正文。摘要与线索增量要再点一次确认。
        </p>
      </div>
      <ol className="list-none p-0 m-0 space-y-1">
        {scenes.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={`btn btn-ghost btn-sm w-full !justify-start ${
                s.id === selectedId ? "!bg-[var(--bg-hover)]" : ""
              }`}
              onClick={() => setSelectedId(s.id)}
            >
              <span className="truncate">
                {s.order}. {s.title}
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-auto shrink-0">
                {STATUS_LABEL[s.status || "pending"]}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {selected ? (
        <div className="space-y-2">
          <p className="text-sm mt-0 mb-0 leading-relaxed">{selected.summary}</p>
          {selected.verbatimAnchors?.length ? (
            <p className="text-xs text-[var(--text-muted)] mt-0 mb-0">
              原句锚点：{selected.verbatimAnchors.join(" / ")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!!busy}
              onClick={() => void draftBeat(selected)}
            >
              {busy === `beat:${selected.id}`
                ? "生成预览…"
                : previewSceneId === selected.id
                  ? "重新生成"
                  : "扩写这一拍"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!preview.trim() || previewSceneId !== selected.id || !!busy}
              onClick={() => acceptBeat(false)}
            >
              接受并写入
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!!busy}
              onClick={skipBeat}
            >
              跳过
            </button>
          </div>
          {previewSceneId === selected.id && (preview || busy) ? (
            <Field label="预览（未写入正文，可改）">
              <textarea
                value={preview}
                onChange={(e) => {
                  setPreview(e.target.value);
                  setAnchorWarn(
                    missingVerbatimAnchors(e.target.value, selected.verbatimAnchors)
                  );
                }}
                rows={10}
                readOnly={!!busy}
              />
            </Field>
          ) : null}
          {anchorWarn.length ? (
            <p className="text-xs text-[var(--danger-text)] mt-0 mb-0">
              缺少必须原样保留的原句：{anchorWarn.join("；")}
            </p>
          ) : null}
          {blocked.length ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--danger-text)] mt-0 mb-0">
                {blocked.join("；")}
              </p>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => acceptBeat(true)}
              >
                强制保存并警告
              </button>
            </div>
          ) : null}
          {deltaDraft && previewSceneId === null ? (
            <div className="space-y-2 border-t border-[var(--border-soft)] pt-2">
              <p className="text-xs text-[var(--text-muted)] mt-0 mb-0">
                建议提交的增量（确认后才改摘要/线索/时间线，不会自动改锁定表）：
              </p>
              <Field label="本章摘要（可改）">
                <textarea
                  value={deltaDraft.summary || ""}
                  onChange={(e) =>
                    setDeltaDraft({ ...deltaDraft, summary: e.target.value })
                  }
                  rows={2}
                />
              </Field>
              <Field label="时间线（可改，留空不写入）">
                <textarea
                  value={deltaDraft.timelineNote || ""}
                  onChange={(e) =>
                    setDeltaDraft({
                      ...deltaDraft,
                      timelineNote: e.target.value,
                    })
                  }
                  rows={2}
                  placeholder="含时间词的句子；留空则不写入世界观"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={confirmDeltas}
                >
                  确认增量
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeltaDraft(null)}
                >
                  忽略增量
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
