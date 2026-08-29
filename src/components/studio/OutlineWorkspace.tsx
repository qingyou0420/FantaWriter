"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OutlineChapterDetail } from "@/components/studio/OutlineChapterDetail";
import { OutlineVolumeDetail } from "@/components/studio/OutlineVolumeDetail";
import { PLANNER_AGENT_LABEL, PLANNER_AGENT_NAME } from "@/lib/brand";
import { chapterWordTargetText } from "@/lib/length";
import {
  chapterRowVisible,
  countDisplayTreeNodes,
  isDefaultAct,
  isDefaultSection,
  treeBranchVisible,
  type OutlineTreeFilter,
} from "@/lib/outline-tree";
import { sortedVolumes } from "@/lib/volumes";
import type {
  Character,
  NovelProject,
  OutlineChapter,
  Volume,
} from "@/lib/types";

export function OutlineWorkspace({
  project,
  selectedId,
  selectedVolumeId,
  onSelectChapter,
  onSelectVolume,
  onAddSibling,
  onAddFirst,
  onAddVolume,
  onWriteThisChapter,
  onViewManuscript,
  onPatchChapter,
  onRemoveChapter,
  onPolishChapter,
  onPatchVolume,
  onGenerateOutline,
  onGenerateVolumeOutline,
  onGenerateNext,
  onGenerateVolumeSummary,
  onOpenCloseWizard,
  onBatchWrite,
  tagLibrary,
  characters,
  busy,
  includeEndingDirection,
  onIncludeEndingDirection,
  hideRollingOutline,
  planChapterCount = 10,
  volumeWizard,
  volumeSummaryDraft,
  onSaveSummaryDraft,
  onDiscardSummaryDraft,
  onEditSummaryDraft,
}: {
  project: NovelProject;
  selectedId?: string | null;
  selectedVolumeId?: string | null;
  onSelectChapter: (chapterId: string) => void;
  onSelectVolume: (volumeId: string) => void;
  onAddSibling: (afterId: string) => void;
  onAddFirst: () => void;
  onAddVolume: () => void;
  onWriteThisChapter: (chapterId: string) => void;
  onViewManuscript: (chapterId: string) => void;
  onPatchChapter: (chapterId: string, partial: Partial<OutlineChapter>) => void;
  onRemoveChapter: (chapterId: string) => void;
  onPolishChapter: (chapter: OutlineChapter) => void;
  onPatchVolume: (volumeId: string, partial: Partial<Volume>) => void;
  onGenerateOutline: () => void;
  onGenerateVolumeOutline: (volumeId: string, chapterCount: number) => void;
  onGenerateNext: (volumeId: string, chapterCount: number) => void;
  onGenerateVolumeSummary: (volumeId: string) => void;
  onOpenCloseWizard: (volumeId: string) => void;
  onBatchWrite: () => void;
  tagLibrary: string[];
  characters: Character[];
  busy: string | null;
  includeEndingDirection?: boolean;
  onIncludeEndingDirection?: (v: boolean) => void;
  hideRollingOutline?: boolean;
  planChapterCount?: number;
  volumeWizard?: ReactNode;
  volumeSummaryDraft?: { volumeId: string; text: string } | null;
  onSaveSummaryDraft?: () => void;
  onDiscardSummaryDraft?: () => void;
  onEditSummaryDraft?: (text: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<OutlineTreeFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [nextCount, setNextCount] = useState(() =>
    Math.max(1, Math.min(20, planChapterCount || 10))
  );
  const tree = project.outlineTree || [];
  const chapters = project.outline?.chapters;
  const volumes = sortedVolumes(project);
  const byId = useMemo(() => {
    const m = new Map<string, OutlineChapter>();
    for (const c of chapters || []) m.set(c.id, c);
    return m;
  }, [chapters]);
  const written = (id: string) =>
    Boolean(project.chapters.find((c) => c.chapterId === id)?.content?.trim());
  const display = countDisplayTreeNodes(tree);
  const writtenCount = (chapters || []).filter((c) => written(c.id)).length;
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedVolume = selectedVolumeId
    ? volumes.find((v) => v.id === selectedVolumeId)
    : undefined;
  const volTitle = (id: string) =>
    volumes.find((v) => v.id === id)?.title || "卷";
  const wordTarget = chapterWordTargetText(
    project.settings.length,
    project.settings.customLength
  );
  const currentVolumeId =
    selectedVolumeId ||
    selected?.volumeId ||
    volumes[volumes.length - 1]?.id ||
    "";

  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector(
      `[data-outline-chapter="${selectedId}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const stats = [
    `${display.volumes} 卷`,
    display.acts ? `${display.acts} 幕` : null,
    display.sections ? `${display.sections} 节` : null,
    `${display.chapters} 章`,
    `${writtenCount} 已写`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex-1 min-h-0 flex">
      <aside className="w-72 shrink-0 border-r border-[var(--border-soft)] flex flex-col min-h-0">
        <div className="p-2 text-xs text-[var(--text-muted)]">{stats}</div>
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onAddVolume}
          >
            + 新增卷
          </button>
          <div className="menu-wrap">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!!busy}
              onClick={() => setMenuOpen((v) => !v)}
            >
              AI 排纲 ▾
            </button>
            {menuOpen ? (
              <div className="menu-dropdown menu-dropdown-wide !left-0 !right-auto">
                <button
                  type="button"
                  className="menu-item"
                  disabled={!!busy}
                  onClick={() => {
                    setMenuOpen(false);
                    onGenerateOutline();
                  }}
                >
                  {busy === "outline" ? "全书重排中…" : "全书重排"}
                </button>
                <button
                  type="button"
                  className="menu-item"
                  disabled={!!busy || !currentVolumeId}
                  onClick={() => {
                    setMenuOpen(false);
                    onGenerateVolumeOutline(
                      currentVolumeId,
                      Math.max(3, planChapterCount || 10)
                    );
                  }}
                >
                  {busy?.startsWith("outline_volume")
                    ? "本卷重排中…"
                    : "本卷重排"}
                </button>
                {!hideRollingOutline ? (
                  <button
                    type="button"
                    className="menu-item"
                    disabled={!!busy || !currentVolumeId}
                    onClick={() => {
                      setMenuOpen(false);
                      onGenerateNext(currentVolumeId, nextCount);
                    }}
                  >
                    {busy?.startsWith("outline_next")
                      ? "续排中…"
                      : `续排本卷 ${nextCount} 章`}
                  </button>
                ) : null}
                {!hideRollingOutline ? (
                  <label className="menu-item !cursor-default flex items-center gap-2">
                    章数
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="!w-16 !py-0.5"
                      value={nextCount}
                      onChange={(e) =>
                        setNextCount(
                          Math.max(
                            1,
                            Math.min(20, Number(e.target.value) || 1)
                          )
                        )
                      }
                    />
                  </label>
                ) : null}
                {onIncludeEndingDirection ? (
                  <label className="menu-item !cursor-default flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="!w-auto"
                      checked={Boolean(includeEndingDirection)}
                      onChange={(e) =>
                        onIncludeEndingDirection(e.target.checked)
                      }
                    />
                    本次把结局方向给 {PLANNER_AGENT_LABEL} 参考
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onBatchWrite}
          >
            批量写正文
          </button>
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
          {tree.map((vol) => {
            const title = volTitle(vol.id);
            const visibleRows: {
              ch: OutlineChapter;
              actTitle?: string;
              secTitle?: string;
            }[] = [];
            for (const act of vol.acts || []) {
              const showAct = !isDefaultAct(act, vol.id);
              for (const sec of act.sections || []) {
                const showSec = !isDefaultSection(sec, vol.id);
                for (const ref of sec.chapters || []) {
                  const ch = byId.get(ref.chapterId);
                  if (!ch) continue;
                  const label = `第${ch.order}章 ${ch.title}`;
                  if (
                    !chapterRowVisible({
                      written: written(ch.id),
                      filter,
                      label,
                      query: q,
                    })
                  ) {
                    continue;
                  }
                  visibleRows.push({
                    ch,
                    actTitle: showAct ? act.title || "幕" : undefined,
                    secTitle: showSec ? sec.title || "节" : undefined,
                  });
                }
              }
            }
            if (
              !treeBranchVisible({
                selfLabel: title,
                query: q,
                filter,
                visibleChapterCount: visibleRows.length,
              })
            ) {
              return null;
            }
            let lastAct: string | undefined;
            let lastSec: string | undefined;
            return (
              <div key={vol.id} className="mb-2">
                <button
                  type="button"
                  className={`studio-tree-row text-xs font-medium ${
                    selectedVolumeId === vol.id && !selectedId ? "active" : ""
                  }`}
                  onClick={() => onSelectVolume(vol.id)}
                >
                  {title}
                </button>
                {visibleRows.map(({ ch, actTitle, secTitle }) => {
                  const bits: ReactNode[] = [];
                  if (actTitle && actTitle !== lastAct) {
                    lastAct = actTitle;
                    bits.push(
                      <div
                        key={`${ch.id}-act`}
                        className="text-xs text-[var(--text-muted)] px-2 pl-4"
                      >
                        {actTitle}
                      </div>
                    );
                  }
                  if (secTitle && secTitle !== lastSec) {
                    lastSec = secTitle;
                    bits.push(
                      <div
                        key={`${ch.id}-sec`}
                        className="text-xs text-[var(--text-muted)] px-2 pl-6"
                      >
                        {secTitle}
                      </div>
                    );
                  }
                  const isWritten = written(ch.id);
                  bits.push(
                    <button
                      key={ch.id}
                      type="button"
                      data-outline-chapter={ch.id}
                      className={`studio-tree-row pl-4 ${
                        selectedId === ch.id && !selectedVolumeId
                          ? "active"
                          : ""
                      }`}
                      onClick={() => onSelectChapter(ch.id)}
                    >
                      <span>{isWritten ? "✓" : "○"}</span>
                      <span className="truncate">
                        第{ch.order}章 {ch.title}
                      </span>
                    </button>
                  );
                  return bits;
                })}
              </div>
            );
          })}
        </div>
      </aside>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {display.chapters === 0 ? (
          <div className="card space-y-3">
            <p className="text-sm text-[var(--text-muted)] m-0">
              还没有章节点。推荐先让{PLANNER_AGENT_NAME}
              起草全书大纲（会弹出确认闸，确认后才写入）；也可以手工占一章再自己填摘要。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busy}
                onClick={onGenerateOutline}
              >
                {busy === "outline" ? (
                  <>
                    <span className="spinner" /> 排大纲中…
                  </>
                ) : (
                  `让${PLANNER_AGENT_NAME}排大纲`
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onAddFirst}
              >
                新增第一章
              </button>
            </div>
          </div>
        ) : null}
        {selectedVolume ? (
          <OutlineVolumeDetail
            volume={selectedVolume}
            chapterCount={(chapters || []).filter(
              (c) =>
                (c.volumeId || volumes[0]?.id) === selectedVolume.id
            ).length}
            busy={busy}
            summaryDraft={volumeSummaryDraft}
            wizard={volumeWizard}
            onPatch={onPatchVolume}
            onGenerateSummary={onGenerateVolumeSummary}
            onOpenCloseWizard={onOpenCloseWizard}
            onSaveSummaryDraft={onSaveSummaryDraft}
            onDiscardSummaryDraft={onDiscardSummaryDraft}
            onEditSummaryDraft={onEditSummaryDraft}
          />
        ) : selected ? (
          <OutlineChapterDetail
            key={selected.id}
            chapter={selected}
            written={written(selected.id)}
            volumeTitle={volTitle(selected.volumeId || volumes[0]?.id || "")}
            wordTarget={wordTarget}
            volumes={volumes}
            characters={characters}
            tagLibrary={tagLibrary}
            busy={busy}
            onPatch={onPatchChapter}
            onWriteThisChapter={onWriteThisChapter}
            onViewManuscript={onViewManuscript}
            onAddSibling={onAddSibling}
            onPolish={onPolishChapter}
            onRemove={onRemoveChapter}
            onSelectVolume={onSelectVolume}
          />
        ) : display.chapters === 0 ? null : (
          <div className="card space-y-3">
            <p className="text-sm text-[var(--text-muted)] m-0">
              从左侧选一个章节点或卷。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
