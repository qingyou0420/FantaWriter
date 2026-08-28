"use client";

import { useMemo, useState } from "react";
import { WRITER_AGENT_LABEL } from "@/lib/brand";
import { previewCanonicalPacket } from "@/lib/canonical-packet";
import type { NovelProject } from "@/lib/types";

type RailTab = "assistant" | "compass" | "context";

export function AssistantRail({
  project,
  chapterId,
  selection,
  collapsed,
  onToggle,
  onAsk,
}: {
  project: NovelProject;
  chapterId?: string | null;
  selection?: string;
  collapsed: boolean;
  onToggle: () => void;
  onAsk?: (question: string, selection: string) => void;
}) {
  const [tab, setTab] = useState<RailTab>("assistant");
  const [q, setQ] = useState("");
  const packet = useMemo(
    () => previewCanonicalPacket(project, chapterId),
    [project, chapterId]
  );

  if (collapsed) {
    return (
      <aside className="studio-rail collapsed">
        <button
          type="button"
          className="studio-nav-item"
          onClick={onToggle}
          title="展开创作助手"
        >
          助
        </button>
      </aside>
    );
  }

  return (
    <aside className="studio-rail">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border-soft)]">
        <div className="flex gap-1">
          {(
            [
              ["assistant", "助手"],
              ["compass", "罗盘"],
              ["context", "上下文"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-ghost btn-sm ${tab === id ? "btn-secondary" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle}>
          收起
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 text-sm">
        {tab === "assistant" ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)] m-0">
              问{WRITER_AGENT_LABEL}
              {selection?.trim() ? " · 已携带选区" : ""}
            </p>
            {selection?.trim() ? (
              <pre className="text-xs whitespace-pre-wrap m-0 p-2 bg-[var(--bg)] rounded">
                {selection.slice(0, 400)}
              </pre>
            ) : null}
            <textarea
              rows={4}
              className="w-full"
              placeholder="这一段节奏是否太慢？"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!q.trim()}
              onClick={() => {
                onAsk?.(q.trim(), selection || "");
                setQ("");
              }}
            >
              发送
            </button>
            <p className="text-xs text-[var(--text-muted)]">
              快捷：分析选区 / 续写建议 / 节奏检查——在提问里写即可。
            </p>
          </div>
        ) : null}
        {tab === "compass" ? (
          <div className="space-y-2">
            <div>
              <div className="text-xs text-[var(--text-muted)]">作者意图</div>
              <p className="m-0">
                {project.premiseCard?.premise ||
                  project.outline?.premise ||
                  "（未填）"}
              </p>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">创作罗盘</div>
              <p className="m-0">
                {project.currentFocus?.stageGoal || "（未填）"}
              </p>
              {project.currentFocus?.mustKeep?.length ? (
                <p className="m-0 text-xs">
                  必须保留：{project.currentFocus.mustKeep.join("；")}
                </p>
              ) : null}
              {project.currentFocus?.mustAvoid?.length ? (
                <p className="m-0 text-xs">
                  必须避免：{project.currentFocus.mustAvoid.join("；")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {tab === "context" ? (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">
              本章 packet 预览（与写章同一装配器）
            </div>
            <pre className="whitespace-pre-wrap text-xs m-0">
              {packet?.priorBlock || "请先选一章。"}
            </pre>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
