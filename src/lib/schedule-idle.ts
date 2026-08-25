/**
 * Run non-critical work after the first paint / input have a chance.
 * Silent desktop update checks use this so they do not compete with typing.
 */
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
