export interface PreferencesStore {
  /**
   * Whether pipeline tool result blocks ("查看操作结果") in chat render
   * expanded by default. Persisted per browser via localStorage.
   */
  toolDetailsDefaultOpen: boolean;

  setToolDetailsDefaultOpen: (open: boolean) => void;
}
