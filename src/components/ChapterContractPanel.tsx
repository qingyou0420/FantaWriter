"use client";

import { useMemo, useState } from "react";
import { CastPicker } from "@/components/CastPicker";
import { Field } from "@/components/Field";
import {
  chapterContractGate,
  chapterGoalText,
} from "@/lib/chapter-contract";
import { formatCharacterStateLedger } from "@/lib/character-states";
import { globalForbidList } from "@/lib/author-secrets";
import { formatLineList, parseLineList, type NovelProject, type OutlineChapter } from "@/lib/types";

export function ChapterContractPanel({
  project,
  chapter,
  onPatchChapter,
  onGenerate,
  onCancel,
  busy,
}: {
  project: NovelProject;
  chapter: OutlineChapter;
  onPatchChapter: (patch: Partial<OutlineChapter>) => void;
  onGenerate: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [confirmedEmptyForbid, setConfirmedEmptyForbid] = useState(false);
  const global = globalForbidList(project.premiseCard);
  const gate = chapterContractGate({
    chapter,
    globalForbid: global,
    confirmedEmptyForbid,
  });
  const castIds = chapter.castIds || [];
  const cast = castIds.length
    ? project.characters.filter((c) => castIds.includes(c.id))
    : project.characters;
  const ledger = formatCharacterStateLedger(
    project.characterStates,
    cast.map((c) => c.name).filter(Boolean),
    3
  );
  const prev = useMemo(() => {
    const list = [...(project.outline?.chapters || [])].sort(
      (a, b) => a.order - b.order
    );
    const last = [...list].reverse().find((c) => c.order < chapter.order);
    const row = last
      ? project.chapters.find((c) => c.chapterId === last.id)
      : undefined;
    return {
      hook: last?.hook || "",
      snippet: row?.content?.slice(-400) || "",
      title: last?.title || "",
    };
  }, [project, chapter.order]);

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold m-0">本章契约</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-0">
            第 {chapter.order} 章 · {chapter.title}。要写什么和不能写什么都过你的手，再生成。
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          返回正文
        </button>
      </div>
      <Field
        label="本章目标"
        hint="过时就地改，存回大纲。空着不能生成。"
      >
        <textarea
          rows={3}
          value={chapter.summary}
          onChange={(e) => onPatchChapter({ summary: e.target.value })}
          placeholder="剧情摘要：这章之后什么变得不一样了"
        />
        <textarea
          className="mt-2"
          rows={2}
          value={chapter.keyPoints}
          onChange={(e) => onPatchChapter({ keyPoints: e.target.value })}
          placeholder="关键情节点 / 冲突"
        />
      </Field>
      <Field label="章末钩子">
        <input
          value={chapter.hook || ""}
          onChange={(e) => onPatchChapter({ hook: e.target.value })}
          placeholder="结尾要悬着的事"
        />
      </Field>
      <Field label="出场人物" hint="不在名单上的人不许出现。">
        <CastPicker
          characters={project.characters}
          castIds={castIds}
          onChange={(ids) => onPatchChapter({ castIds: ids })}
        />
      </Field>
      <Field label="时间与地点">
        <input
          value={chapter.timePlace || ""}
          onChange={(e) => onPatchChapter({ timePlace: e.target.value })}
          placeholder="接上章之后多久、在哪"
        />
      </Field>
      <div className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs whitespace-pre-wrap">
        <div className="font-medium mb-1">约束现状（只读）</div>
        {ledger || "账本尚无该批出场人物的记录。"}
      </div>
      <div>
        <div className="field-label mb-1">禁写清单</div>
        {global.length ? (
          <ul className="text-xs text-[var(--text-muted)] mt-0 mb-2 pl-4">
            {global.map((line) => (
              <li key={line}>全书：{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--text-muted)] mt-0 mb-2">
            前提卡尚无全书禁写。
          </p>
        )}
        <textarea
          rows={3}
          value={formatLineList(chapter.forbidList)}
          onChange={(e) =>
            onPatchChapter({ forbidList: parseLineList(e.target.value) })
          }
          placeholder="本章特有禁令，一行一条，如：不得暗示 X 与 Y 的血缘"
        />
        {gate.emptyForbid ? (
          <label className="flex items-center gap-2 text-xs mt-2">
            <input
              type="checkbox"
              className="!w-auto"
              checked={confirmedEmptyForbid}
              onChange={(e) => setConfirmedEmptyForbid(e.target.checked)}
            />
            本章确无禁写
          </label>
        ) : null}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--text-muted)]">
          上章结尾{prev.title ? ` · ${prev.title}` : ""}
        </summary>
        {prev.hook ? <p className="mt-1 mb-1">上章钩子：{prev.hook}</p> : null}
        <p className="whitespace-pre-wrap mt-1 mb-0 text-[var(--text-muted)]">
          {prev.snippet || "（无）"}
        </p>
      </details>
      {gate.emptyGoal ? (
        <p className="text-xs text-[var(--danger)] m-0">
          「要写什么」还是空的，先补摘要或关键点。
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || !gate.canGenerate}
          onClick={onGenerate}
        >
          {busy ? "生成中…" : "按契约生成"}
        </button>
        <span className="text-xs text-[var(--text-muted)] self-center">
          {chapterGoalText(chapter) ? "要写什么已过手" : "要写什么为空"}
          {" · "}
          {gate.emptyForbid
            ? confirmedEmptyForbid
              ? "已确认无禁写"
              : "禁写栏空着"
            : "不能写什么已过手"}
        </span>
      </div>
    </div>
  );
}
