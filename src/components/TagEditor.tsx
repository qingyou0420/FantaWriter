"use client";

import { useState } from "react";
import { parseTagsFromText } from "@/lib/types";

/** 可选标签芯片：点击切换选中 */
export function TagSelector({
  library,
  selected,
  onChange,
  label = "选择标签",
  hint,
}: {
  library: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const selectedSet = new Set(selected);

  function toggle(tag: string) {
    if (selectedSet.has(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  function clear() {
    onChange([]);
  }

  return (
    <div className="field">
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="field-label !mb-0">{label}</label>
        {selected.length > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            清空已选（{selected.length}）
          </button>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[0.7rem] text-[var(--text-muted)] mt-0 mb-2 leading-snug">
          {hint}
        </p>
      ) : null}
      {library.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] m-0">
          标签库为空，请先在「标签」页添加。
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {library.map((tag) => {
            const on = selectedSet.has(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${on ? "tag-chip-on" : ""}`}
                onClick={() => toggle(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
      {/* 选中但不在库中的标签（导入项目等） */}
      {selected.some((t) => !library.includes(t)) ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected
            .filter((t) => !library.includes(t))
            .map((tag) => (
              <button
                key={tag}
                type="button"
                className="tag-chip tag-chip-on"
                onClick={() => toggle(tag)}
                title="不在标签库中，点击取消"
              >
                {tag} ×
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

/** 标签库管理：增删 + 斜杠批量导入 */
export function TagLibraryManager({
  library,
  onChange,
}: {
  library: string[];
  onChange: (tags: string[]) => void;
}) {
  const [bulk, setBulk] = useState("");
  const [single, setSingle] = useState("");

  function addBulk() {
    const parsed = parseTagsFromText(bulk);
    if (!parsed.length) return;
    const seen = new Set(library);
    const next = [...library];
    for (const t of parsed) {
      if (!seen.has(t)) {
        seen.add(t);
        next.push(t);
      }
    }
    onChange(next);
    setBulk("");
  }

  function addSingle() {
    const t = single.trim();
    if (!t) return;
    if (!library.includes(t)) onChange([...library, t]);
    setSingle("");
  }

  function remove(tag: string) {
    onChange(library.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {library.length === 0 ? (
          <span className="text-xs text-[var(--text-muted)]">暂无标签</span>
        ) : (
          library.map((tag) => (
            <span key={tag} className="tag-chip tag-chip-lib">
              {tag}
              <button
                type="button"
                className="tag-x"
                title="从库中删除"
                onClick={() => remove(tag)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSingle()}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={addSingle}>
          添加
        </button>
      </div>

      <div>
        <label className="field-label">批量导入（用 / 间隔）</label>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={2}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm mt-2"
          onClick={addBulk}
          disabled={!bulk.trim()}
        >
          一键导入标签
        </button>
      </div>
    </div>
  );
}
