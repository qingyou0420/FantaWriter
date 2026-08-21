import type { ChapterContent, OutlineChapter } from "./types";

/** 全书生成任务：单章状态 */
export type BookJobItemStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped";

export interface BookJobItem {
  chapterId: string;
  order: number;
  title: string;
  status: BookJobItemStatus;
  error?: string;
  /** 中断/失败时保留的流式 partial */
  partialContent?: string;
}

export type BookJobStatus =
  | "idle"
  | "running"
  | "paused"
  | "done"
  | "error";

/** 全书批量生成任务（可序列化，便于暂停/续跑） */
export interface BookJob {
  id: string;
  status: BookJobStatus;
  items: BookJobItem[];
  currentChapterId: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * all — 覆盖全部
   * missing — 跳过已有正文的章
   * retry_errors — 仅重试 error 项
   */
  mode: "all" | "missing" | "retry_errors";
  /** 仅生成本卷；不要复用 mode */
  volumeId?: string;
}

export function createBookJob(
  outlineChapters: OutlineChapter[],
  existing: ChapterContent[],
  mode: BookJob["mode"] = "missing",
  volumeId?: string
): BookJob {
  const now = new Date().toISOString();
  let sorted = [...outlineChapters].sort((a, b) => a.order - b.order);
  if (volumeId) {
    sorted = sorted.filter((ch) => ch.volumeId === volumeId);
  }

  const items: BookJobItem[] = sorted.map((ch) => {
    const row = existing.find((c) => c.chapterId === ch.id);
    const hasContent = Boolean(row?.content?.trim() && row.status === "done");

    let status: BookJobItemStatus = "pending";
    if (mode === "missing" && hasContent) status = "skipped";
    if (mode === "retry_errors") {
      status = row?.status === "error" ? "pending" : "skipped";
    }
    if (mode === "all") status = "pending";

    return {
      chapterId: ch.id,
      order: ch.order,
      title: ch.title,
      status,
    };
  });

  return {
    id: crypto.randomUUID(),
    status: "idle",
    items,
    currentChapterId: null,
    createdAt: now,
    updatedAt: now,
    mode,
    volumeId,
  };
}

export function bookJobProgress(job: BookJob | null | undefined): {
  total: number;
  done: number;
  pending: number;
  error: number;
  skipped: number;
  running: number;
  percent: number;
} {
  if (!job?.items.length) {
    return {
      total: 0,
      done: 0,
      pending: 0,
      error: 0,
      skipped: 0,
      running: 0,
      percent: 0,
    };
  }
  const total = job.items.length;
  let done = 0;
  let pending = 0;
  let error = 0;
  let skipped = 0;
  let running = 0;
  for (const it of job.items) {
    if (it.status === "done") done++;
    else if (it.status === "pending") pending++;
    else if (it.status === "error") error++;
    else if (it.status === "skipped") skipped++;
    else if (it.status === "running") running++;
  }
  const finished = done + skipped;
  const percent = total ? Math.round((finished / total) * 100) : 0;
  return { total, done, pending, error, skipped, running, percent };
}

/** 下一章待处理（pending 优先，其次 error 可重试时由调用方 reset） */
export function nextPendingItem(job: BookJob): BookJobItem | null {
  const sorted = [...job.items].sort((a, b) => a.order - b.order);
  return sorted.find((it) => it.status === "pending") || null;
}

export function patchBookJobItem(
  job: BookJob,
  chapterId: string,
  patch: Partial<BookJobItem>
): BookJob {
  const now = new Date().toISOString();
  return {
    ...job,
    updatedAt: now,
    items: job.items.map((it) =>
      it.chapterId === chapterId ? { ...it, ...patch } : it
    ),
  };
}

export function finalizeBookJobStatus(job: BookJob): BookJob {
  const { pending, running, error } = bookJobProgress(job);
  let status: BookJobStatus = job.status;
  if (running > 0) status = "running";
  else if (pending > 0) status = job.status === "paused" ? "paused" : "idle";
  else if (error > 0) status = "error";
  else status = "done";
  return { ...job, status, updatedAt: new Date().toISOString() };
}

/**
 * 崩溃/刷新后：无主 running 队列归 pending，job 置 paused。
 * 仅当 UI 侧确认当前没有在跑（jobControl.running === false）时调用。
 */
export function normalizeStaleJob(job: BookJob): BookJob {
  if (job.status !== "running") return job;
  const now = new Date().toISOString();
  return {
    ...job,
    status: "paused",
    currentChapterId: null,
    updatedAt: now,
    items: job.items.map((it) =>
      it.status === "running"
        ? { ...it, status: "pending" as const, error: undefined }
        : it
    ),
  };
}

/** 将 error / 中断 running 重置为 pending 以便续跑 */
export function prepareJobForResume(job: BookJob): BookJob {
  const now = new Date().toISOString();
  return {
    ...job,
    status: "idle",
    currentChapterId: null,
    updatedAt: now,
    items: job.items.map((it) => {
      if (it.status === "error" || it.status === "running") {
        return { ...it, status: "pending" as const, error: undefined };
      }
      return it;
    }),
  };
}

export function prepareRetryErrors(job: BookJob): BookJob {
  const now = new Date().toISOString();
  return {
    ...job,
    status: "idle",
    currentChapterId: null,
    mode: "retry_errors",
    updatedAt: now,
    items: job.items.map((it) =>
      it.status === "error"
        ? { ...it, status: "pending" as const, error: undefined }
        : it
    ),
  };
}
