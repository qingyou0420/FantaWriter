"use client";

import { useMemo, useState } from "react";
import { boardCopy } from "@/lib/copy";
import {
  CONVERT_UNLOCK_TOKEN,
  convertProjectWritingBoard,
} from "@/lib/storage";
import type { NovelProject, WritingBoard } from "@/lib/types";

export function ConvertModeWizard({
  project,
  onClose,
  onConverted,
}: {
  project: NovelProject;
  onClose: () => void;
  onConverted: (next: NovelProject, inPlace: boolean) => void;
}) {
  const to: WritingBoard =
    project.writingBoard === "erotic" ? "general" : "erotic";
  const fromCopy = boardCopy(project.writingBoard);
  const toCopy = boardCopy(to);
  const defaultTitle = `${project.name || "未命名"}（${toCopy.label}）`;
  const [title, setTitle] = useState(defaultTitle);
  const [inPlace, setInPlace] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [keep, setKeep] = useState<string[]>([]);
  const [error, setError] = useState("");

  const actTags = useMemo(
    () => (project.writingBoard === "erotic" ? project.tags || [] : []),
    [project]
  );

  function toggleKeep(tag: string) {
    setKeep((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function submit() {
    setError("");
    if (inPlace && confirmName !== project.name) {
      setError("原地转换请输入当前书名以确认");
      return;
    }
    try {
      const next = convertProjectWritingBoard(project, to, {
        unlockToken: CONVERT_UNLOCK_TOKEN,
        title: inPlace ? project.name : title,
        inPlace,
        keepGenreTags: keep,
      });
      onConverted(next, inPlace);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card !w-min(32rem,100%) max-w-lg">
        <h2 className="text-base font-semibold m-0 mb-2">转换写作台</h2>
        <p className="text-sm text-[var(--text-muted)] m-0 mb-3 leading-relaxed">
          从「{fromCopy.label}」转到「{toCopy.label}」。默认另存为新书，源项目写作台不变。
        </p>
        <ul className="text-xs text-[var(--text-muted)] m-0 mb-3 pl-4 leading-relaxed">
          {to === "general" ? (
            <>
              <li>行为标签会归档，assemble 不再读取</li>
              <li>学习文风快照会清空，避免色情写法注入常规书</li>
              <li>尺度数值保留，常规界面与生成不展示</li>
            </>
          ) : (
            <>
              <li>类型标签会保留，可再勾选行为标签</li>
              <li>色情尺度沿用当前数值（默认 3）</li>
            </>
          )}
        </ul>

        {actTags.length ? (
          <div className="mb-3">
            <div className="text-xs font-medium mb-1">保留为类型标签</div>
            <div className="flex flex-wrap gap-1.5">
              {actTags.map((t) => (
                <label key={t} className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={keep.includes(t)}
                    onChange={() => toggleKeep(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {!inPlace ? (
          <label className="block text-xs mb-3">
            新书名
            <input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        ) : (
          <label className="block text-xs mb-3">
            输入当前书名「{project.name}」以确认原地转换
            <input
              className="mt-1"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-xs mb-3 text-[var(--danger-text)]">
          <input
            type="checkbox"
            checked={inPlace}
            onChange={(e) => setInPlace(e.target.checked)}
          />
          原地转换（危险，会改这本书的写作台）
        </label>

        {error ? (
          <p className="text-xs text-[var(--danger-text)] m-0 mb-2">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {inPlace ? "确认原地转换" : "另存并打开"}
          </button>
        </div>
      </div>
    </div>
  );
}
