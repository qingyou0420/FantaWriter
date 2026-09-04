export type ManuscriptExportFormat = "txt" | "md";

export function bookManuscriptExportPath(
  bookId: string,
  format: ManuscriptExportFormat | "epub" = "txt",
  approvedOnly = false,
): string {
  const params = new URLSearchParams({ format });
  if (approvedOnly) params.set("approvedOnly", "true");
  return `/api/v1/books/${encodeURIComponent(bookId)}/export?${params.toString()}`;
}

export function shortManuscriptExportPath(
  shortId: string,
  format: ManuscriptExportFormat = "txt",
): string {
  return `/api/v1/shorts/${encodeURIComponent(shortId)}/export?format=${format}`;
}

export function manuscriptToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function continueShortPrompt(title: string, storyId: string): { zh: string; en: string } {
  return {
    zh: `继续这篇短篇「${title}」（storyId: ${storyId}）。从当前进度接着写完。`,
    en: `Continue the short story "${title}" (storyId: ${storyId}) from its current progress.`,
  };
}
