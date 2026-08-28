"use client";

import { markAuthorCanonEdit } from "@/lib/canon-gate";
import type { CurrentFocus, NovelProject } from "@/lib/types";

export function FocusPanel({
  project,
  onChange,
}: {
  project: NovelProject;
  onChange: (next: NovelProject) => void;
}) {
  const focus = project.currentFocus || {
    stageGoal: "",
    mustKeep: [],
    mustAvoid: [],
    source: "author" as const,
  };

  function patch(partial: Partial<CurrentFocus>) {
    onChange(
      markAuthorCanonEdit({
        ...project,
        currentFocus: { ...focus, ...partial, source: "author" },
      })
    );
  }

  return (
    <div className="card space-y-3 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold m-0">创作罗盘</h2>
        <p className="text-sm text-[var(--text-muted)] m-0 mt-1">
          近期阶段目标。迁入的旧书可能带「迁移生成，请修改」字样。
        </p>
      </div>
      {focus.source === "migrated" ? (
        <p className="text-sm text-[var(--warning)] m-0">
          这段是迁移占位，请改成你现在真正想盯住的方向。
        </p>
      ) : null}
      <label className="block text-sm">
        阶段目标
        <textarea
          className="mt-1 w-full"
          rows={4}
          value={focus.stageGoal}
          onChange={(e) => patch({ stageGoal: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        必须保留（一行一条）
        <textarea
          className="mt-1 w-full"
          rows={3}
          value={focus.mustKeep.join("\n")}
          onChange={(e) =>
            patch({
              mustKeep: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="block text-sm">
        必须避免（一行一条）
        <textarea
          className="mt-1 w-full"
          rows={3}
          value={focus.mustAvoid.join("\n")}
          onChange={(e) =>
            patch({
              mustAvoid: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
    </div>
  );
}
