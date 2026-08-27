/**
 * Homepage create fields must accept clicks/keystrokes as soon as the
 * window paints. Library boot, silent update, /api/config, and IndexedDB
 * all run in the background; none of them may disable or overlay the form.
 */

export type HomeCreateFieldLocks = {
  storageReady?: boolean;
  updateBusy?: boolean;
  configReady?: boolean;
  libraryReady?: boolean;
};

/**
 * Always false. Kept as a function so tests lock the contract against
 * future "wait for ready" regressions.
 */
export function shouldDisableHomeCreateFields(
  storageReadyOrLocks: boolean | HomeCreateFieldLocks = false
): boolean {
  void storageReadyOrLocks;
  return false;
}

/** First paint is idle — requestIdleCallback would fire immediately. */
export function shouldStartHomeLibraryBootImmediately(): boolean {
  return false;
}

/**
 * Silent GitHub / folder scan must not start on first idle.
 * Use a real timer, not requestIdleCallback.
 */
export const SILENT_UPDATE_DELAY_MS = 20_000;

export const HOME_CREATE_FIELD_NAMES = [
  "project-name",
  "original-title",
  "original-text",
] as const;

export function homeCreateFieldsDisabledState(
  locks: boolean | HomeCreateFieldLocks = false
): Record<(typeof HOME_CREATE_FIELD_NAMES)[number], boolean> {
  const disabled = shouldDisableHomeCreateFields(locks);
  return {
    "project-name": disabled,
    "original-title": disabled,
    "original-text": disabled,
  };
}
