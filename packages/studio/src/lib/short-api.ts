import { fetchJson, invalidateApiPaths, StudioApiError } from "../hooks/use-api";

/** Studio API path for a short. Chinese ids like 明日来信 must be encoded, same as the reader. */
export function encodeShortApiPath(storyId: string, suffix = ""): string {
  return `/shorts/${encodeURIComponent(storyId)}${suffix}`;
}

export function shortCollectionInvalidationPaths(storyId: string): ReadonlyArray<string> {
  return ["/api/v1/shorts", `/api/v1/shorts/${encodeURIComponent(storyId)}`];
}

export function isShortAlreadyGoneError(error: unknown): boolean {
  if (!(error instanceof StudioApiError)) return false;
  return error.status === 404 || error.code === "NOT_FOUND";
}

/**
 * Delete a short work and always drop it from the works-list cache.
 * 404 / already-missing folders count as success so ghosts can be cleared.
 */
export async function deleteStudioShortWork(
  storyId: string,
  deps?: {
    readonly fetchJson?: typeof fetchJson;
    readonly invalidate?: typeof invalidateApiPaths;
  },
): Promise<{ readonly ok: true; readonly alreadyGone: boolean }> {
  const path = encodeShortApiPath(storyId);
  let alreadyGone = false;
  try {
    await (deps?.fetchJson ?? fetchJson)(path, { method: "DELETE" });
  } catch (error) {
    if (!isShortAlreadyGoneError(error)) throw error;
    alreadyGone = true;
  }
  (deps?.invalidate ?? invalidateApiPaths)(shortCollectionInvalidationPaths(storyId));
  return { ok: true, alreadyGone };
}
