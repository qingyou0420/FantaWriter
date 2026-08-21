import { sleep } from "./user-error";

/** 队列等摘要落地的上限：超时不阻断下一章 */
export const CHAPTER_SUMMARY_WAIT_MS = 18_000;

export async function awaitChapterSummary(
  pending: Promise<unknown> | null | undefined,
  timeoutMs = CHAPTER_SUMMARY_WAIT_MS
): Promise<"ok" | "timeout" | "error"> {
  if (!pending) return "ok";
  try {
    const outcome = await Promise.race([
      pending.then(() => "ok" as const).catch(() => "error" as const),
      sleep(timeoutMs).then(() => "timeout" as const),
    ]);
    return outcome;
  } catch {
    return "error";
  }
}
