/** 桌面端自动备份滚动保留份数 */
export const DESKTOP_BACKUP_KEEP = 7;

const BACKUP_NAME_RE = /^fw-auto-.+\.json$/i;

/** 按文件名（日期）排序，标出应删除的旧份 */
export function rotateBackupNames(
  names: string[],
  keep = DESKTOP_BACKUP_KEEP
): { keep: string[]; remove: string[] } {
  const backups = names.filter((n) => BACKUP_NAME_RE.test(n)).sort();
  if (backups.length <= keep) {
    return { keep: backups, remove: [] };
  }
  const remove = backups.slice(0, backups.length - keep);
  return { keep: backups.slice(backups.length - keep), remove };
}

export function desktopBackupFileName(at = new Date()): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  return `fw-auto-${stamp}.json`;
}
