"use client";

import type { Character } from "@/lib/types";

export function CastPicker({
  characters,
  castIds,
  onChange,
}: {
  characters: Character[];
  castIds?: string[];
  onChange: (ids: string[]) => void;
}) {
  const named = characters.filter((c) => c.name?.trim() || c.id);
  if (!named.length) return null;
  const selected = new Set(castIds || []);
  return (
    <div className="mt-2">
      <p className="field-label mb-1">本章出场人物</p>
      <p className="text-xs text-[var(--text-muted)] mt-0 mb-2">
        勾选后只把这些人完整注入提示词；不选则仍全量。其余人物降级为一行名片。
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {named.map((c) => (
          <label
            key={c.id}
            className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              className="!w-auto"
              checked={selected.has(c.id)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(c.id)) next.delete(c.id);
                else next.add(c.id);
                onChange([...next]);
              }}
            />
            <span>{c.name || "未命名"}</span>
            {c.role ? (
              <span className="text-[var(--text-muted)] text-xs">{c.role}</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}
