"use client";

import { PLANNER_AGENT_LABEL, WRITER_AGENT_LABEL } from "@/lib/brand";
import type { NovelProject } from "@/lib/types";

export function SessionsWorkspace({ project }: { project: NovelProject }) {
  const sessions = project.sessions || [];
  if (!sessions.length) {
    return (
      <div className="p-5 max-w-2xl">
        <h2 className="text-lg font-semibold">AI 协作</h2>
        <p className="text-sm text-[var(--text-muted)]">
          规划（{PLANNER_AGENT_LABEL}）与写作（{WRITER_AGENT_LABEL}
          ）的过程会记在这里。写下一章、确认正典时会留下阶段与确认记录。
        </p>
      </div>
    );
  }
  return (
    <div className="p-5 space-y-3 overflow-y-auto">
      {sessions.map((s) => (
        <div key={s.id} className="card">
          <div className="flex justify-between gap-2">
            <strong>{s.title}</strong>
            <span className="text-xs text-[var(--text-muted)]">
              {s.kind === "planner" ? PLANNER_AGENT_LABEL : WRITER_AGENT_LABEL}
            </span>
          </div>
          <ol className="m-0 mt-2 pl-4 text-sm space-y-1">
            {s.events.map((e) => (
              <li key={e.id}>
                <span className="text-[var(--text-muted)] text-xs">
                  {e.kind}
                </span>{" "}
                {e.title}
                {e.detail ? (
                  <div className="text-xs text-[var(--text-muted)]">{e.detail}</div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
