import type {
  NovelProject,
  StudioSession,
  StudioSessionEvent,
  StudioSessionKind,
} from "./types";

export function appendStudioSessionEvent(
  project: NovelProject,
  sessionId: string | undefined,
  event: Omit<StudioSessionEvent, "id" | "at"> & { at?: string },
  meta?: { kind?: StudioSessionKind; title?: string }
): NovelProject {
  const now = new Date().toISOString();
  const ev: StudioSessionEvent = {
    id: crypto.randomUUID(),
    at: event.at || now,
    kind: event.kind,
    title: event.title,
    detail: event.detail,
  };
  const sessions = [...(project.sessions || [])];
  const idx = sessionId
    ? sessions.findIndex((s) => s.id === sessionId)
    : -1;
  if (idx >= 0) {
    sessions[idx] = {
      ...sessions[idx],
      updatedAt: now,
      events: [...sessions[idx].events, ev].slice(-80),
    };
    return { ...project, sessions };
  }
  const created: StudioSession = {
    id: sessionId || crypto.randomUUID(),
    kind: meta?.kind || "writer",
    title: meta?.title || (meta?.kind === "planner" ? "规划 · 织卷" : "写作 · 落墨"),
    createdAt: now,
    updatedAt: now,
    events: [ev],
  };
  return { ...project, sessions: [created, ...sessions] };
}
