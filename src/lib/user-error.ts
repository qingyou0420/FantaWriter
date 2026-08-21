/** 给作者看的错误：第一句人话，诊断另放 */

export class UserFacingError extends Error {
  diagnostic?: string;
  constructor(message: string, diagnostic?: string) {
    super(message);
    this.name = "UserFacingError";
    this.diagnostic = diagnostic;
  }
}

export function isTransientAiError(err: unknown): boolean {
  const text = [
    err instanceof Error ? err.message : "",
    typeof err === "string" ? err : "",
    err && typeof err === "object" && "diagnostic" in err
      ? String((err as { diagnostic?: string }).diagnostic || "")
      : "",
  ]
    .join(" ")
    .toLowerCase();
  if (!text.trim()) return false;
  if (
    /timeout|etimedout|econnreset|econnrefused|enotfound|network|socket hang up|fetch failed|aborted/.test(
      text
    )
  ) {
    return true;
  }
  if (/http 5\d\d|\b5\d\d\b|502|503|504|bad gateway|service unavailable/.test(text)) {
    return true;
  }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function splitErrorForDisplay(err: unknown): {
  message: string;
  diagnostic?: string;
} {
  if (err instanceof UserFacingError) {
    return { message: err.message, diagnostic: err.diagnostic };
  }
  if (err instanceof Error) {
    const extra =
      "diagnostic" in err
        ? String((err as { diagnostic?: string }).diagnostic || "")
        : "";
    return { message: err.message, diagnostic: extra || undefined };
  }
  return { message: String(err) };
}
