/**
 * Startup helpers. Do not use requestIdleCallback for first-paint work:
 * after the homepage paints the page *is* idle, so the callback runs at
 * the same moment the user tries to click the project-name field.
 */

/** @deprecated Prefer scheduleDeferredWork — idle callbacks race first input. */
export function scheduleIdleWork(
  fn: () => void,
  timeoutMs = 2000
): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => fn(), { timeout: timeoutMs });
    return () => cancelIdleCallback(id);
  }
  const delay = Math.min(800, Math.max(0, timeoutMs));
  const t = setTimeout(fn, delay);
  return () => clearTimeout(t);
}

/** Real delay. `delayMs = 0` yields one macrotask so the first click lands. */
export function scheduleDeferredWork(
  fn: () => void,
  delayMs: number
): () => void {
  const t = setTimeout(fn, Math.max(0, delayMs));
  return () => clearTimeout(t);
}
