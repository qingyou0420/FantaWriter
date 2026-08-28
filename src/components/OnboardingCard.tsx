"use client";

import { EmptyState } from "@/components/EmptyState";
import type { NovelProject } from "@/lib/types";

const DISMISS_PREFIX = "fantawriter:onboarding-dismissed:";

export function isOnboardingDismissed(projectId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISS_PREFIX + projectId) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboarding(projectId: string) {
  try {
    localStorage.setItem(DISMISS_PREFIX + projectId, "1");
  } catch {
    /* ignore */
  }
}

export function shouldShowOnboarding(project: NovelProject): boolean {
  const named = (project.characters || []).some((c) => (c.name || "").trim());
  const synopsis = Boolean((project.background?.synopsis || "").trim());
  const outline = Boolean(project.outline?.chapters.length);
  return !named && !synopsis && !outline;
}

export function OnboardingCard({
  project,
  onGo,
  onDismiss,
}: {
  project: NovelProject;
  onGo: (step: "premise" | "characters" | "background" | "outline" | "chapters") => void;
  onDismiss: () => void;
}) {
  const named = (project.characters || []).some((c) => (c.name || "").trim());
  const synopsis = Boolean((project.background.synopsis || "").trim());
  const outline = Boolean(project.outline?.chapters.length);
  const firstDone = Boolean(
    project.chapters.some((c) => (c.content || "").trim())
  );
  const premiseDone = Boolean(
    (project.premiseCard?.premise || project.outline?.premise || "").trim()
  );
  const steps = [
    { id: "premise" as const, label: "填前提卡", done: premiseDone },
    { id: "characters" as const, label: "写人物", done: named },
    { id: "background" as const, label: "写背景", done: synopsis },
    { id: "outline" as const, label: "生成大纲", done: outline },
    { id: "chapters" as const, label: "写下一章", done: firstDone },
  ];
  return (
    <EmptyState
      title="开写五步"
      description="从前提卡到第一章。完成一项会打勾；老项目不会看到这张卡。"
      action={
        <div className="space-y-3">
          <ol className="list-none p-0 m-0 space-y-2">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-full justify-between"
                  onClick={() => onGo(s.id)}
                >
                  <span>
                    {i + 1}. {s.label}
                  </span>
                  <span>{s.done ? "✓" : "→"}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
            不再显示
          </button>
        </div>
      }
    />
  );
}
