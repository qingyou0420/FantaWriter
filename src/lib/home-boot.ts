/**
 * Homepage create fields paint before initStorage / /api/config finish.
 * They must stay enabled so the first keystroke is not swallowed.
 * Only the project list waits on `ready`.
 */
export function shouldDisableHomeCreateFields(_storageReady: boolean): boolean {
  return false;
}
