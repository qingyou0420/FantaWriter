/**
 * 把章节正文写成文件夹内的 Markdown，供作者在磁盘上润色。
 * 与「导出全书」MD/TXT/EPUB/DOC 独立；不写项目 JSON。
 */
import { downloadBlob } from "./export-book";
import { getDesktop, isDesktopApp } from "./desktop";
import { loadAppPrefs, saveAppPrefs } from "./theme";
import type { ChapterContent, NovelProject, OutlineChapter } from "./types";
import { chaptersGroupedByVolume } from "./volumes";
import { createZip } from "./zip";

export const DEFAULT_CHAPTER_EXPORT_SUBDIR = "novels";
export const CHAPTER_MARKDOWN_FORMAT = "fantawriter-chapter";

const UNSAFE_SEGMENT = /[<>:"/\\|?*]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export type ChapterRepoExportMode = "current" | "done";

export type ChapterFileMeta = {
  format: typeof CHAPTER_MARKDOWN_FORMAT;
  projectId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  order: number;
  volumeId: string;
  volumeTitle: string;
  writingBoard: NovelProject["writingBoard"];
  status: ChapterContent["status"] | "unknown";
  exportedAt: string;
};

export type ChapterRepoFile = {
  relativePath: string;
  fileName: string;
  content: string;
  meta: ChapterFileMeta;
  chapterId: string;
};

export type ChapterRepoExportResult = {
  ok: boolean;
  via: "desktop" | "download";
  files: string[];
  root?: string;
  message: string;
};

export function sanitizePathSegment(raw: string, fallback = "untitled"): string {
  let s = String(raw ?? "").normalize("NFKC");
  s = s.replace(/[\u0000-\u001f]/g, " ");
  s = s.replace(UNSAFE_SEGMENT, "_");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[. ]+$/g, "").replace(/^[. ]+/g, "");
  if (s.length > 80) s = s.slice(0, 80).replace(/[. ]+$/g, "").trim();
  if (!s || s === "." || s === ".." || WINDOWS_RESERVED.test(s) || /^_+$/.test(s)) {
    return fallback;
  }
  return s;
}

/** 禁止绝对路径与 `..`，斜杠统一为 `/` */
export function assertSafeRelativePath(rel: string): string {
  const normalized = String(rel ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
  if (!normalized) {
    throw new Error("相对路径为空");
  }
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error("不允许绝对路径");
  }
  const parts = normalized.split("/").filter((p) => p && p !== ".");
  if (!parts.length || parts.some((p) => p === "..")) {
    throw new Error("相对路径非法");
  }
  return parts.join("/");
}

/** 空或 `.` 表示直接写在所选根目录下；缺省为 novels */
export function normalizeExportSubdir(raw?: string | null): string {
  if (raw == null) return DEFAULT_CHAPTER_EXPORT_SUBDIR;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === ".") return "";
  return assertSafeRelativePath(trimmed)
    .split("/")
    .map((p) => sanitizePathSegment(p, DEFAULT_CHAPTER_EXPORT_SUBDIR))
    .join("/");
}

export function bookExportFolderName(project: NovelProject): string {
  const title = project.background?.title || project.name || "";
  return sanitizePathSegment(title, `book-${project.id.slice(0, 8)}`);
}

/**
 * 只含 chapterId，标题/章序改了仍覆盖同一文件（正文与 frontmatter 里有标题）。
 */
export function chapterRepoFileName(ch: {
  id: string;
  order?: number;
  title?: string;
}): string {
  const id = sanitizePathSegment(ch.id, "unknown");
  return `ch-${id}.md`;
}

export function chapterRepoRelativePath(
  project: NovelProject,
  ch: OutlineChapter,
  subdir?: string | null
): string {
  const prefix = normalizeExportSubdir(subdir);
  const book = bookExportFolderName(project);
  const file = chapterRepoFileName(ch);
  const rel = prefix ? `${prefix}/${book}/${file}` : `${book}/${file}`;
  return assertSafeRelativePath(rel);
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

export function projectBookTitle(project: NovelProject): string {
  return project.background?.title || project.name || "未命名小说";
}

function chapterRow(
  project: NovelProject,
  chapterId: string
): ChapterContent | undefined {
  return project.chapters.find((c) => c.chapterId === chapterId);
}

function chapterBody(project: NovelProject, chapterId: string): string {
  return chapterRow(project, chapterId)?.content || "";
}

function volumeInfo(project: NovelProject, ch: OutlineChapter) {
  const groups = chaptersGroupedByVolume(project);
  const g = groups.find((x) => x.chapters.some((c) => c.id === ch.id));
  return {
    volumeId: ch.volumeId || g?.volume.id || "",
    volumeTitle: g?.volume.title || "",
  };
}

export function buildChapterFileMeta(
  project: NovelProject,
  ch: OutlineChapter,
  exportedAt = new Date().toISOString()
): ChapterFileMeta {
  const row = chapterRow(project, ch.id);
  const vol = volumeInfo(project, ch);
  return {
    format: CHAPTER_MARKDOWN_FORMAT,
    projectId: project.id,
    chapterId: ch.id,
    bookTitle: projectBookTitle(project),
    chapterTitle: ch.title,
    order: ch.order,
    volumeId: vol.volumeId,
    volumeTitle: vol.volumeTitle,
    writingBoard: project.writingBoard,
    status: row?.status || "unknown",
    exportedAt,
  };
}

export function buildChapterMarkdown(
  project: NovelProject,
  ch: OutlineChapter,
  exportedAt?: string
): string {
  const meta = buildChapterFileMeta(project, ch, exportedAt);
  const body = chapterBody(project, ch.id).replace(/\r\n/g, "\n").trimEnd();
  const front = [
    "---",
    `format: ${meta.format}`,
    `projectId: ${yamlScalar(meta.projectId)}`,
    `chapterId: ${yamlScalar(meta.chapterId)}`,
    `bookTitle: ${yamlScalar(meta.bookTitle)}`,
    `chapterTitle: ${yamlScalar(meta.chapterTitle)}`,
    `order: ${meta.order}`,
    `volumeId: ${yamlScalar(meta.volumeId)}`,
    `volumeTitle: ${yamlScalar(meta.volumeTitle)}`,
    `writingBoard: ${meta.writingBoard}`,
    `status: ${meta.status}`,
    `exportedAt: ${yamlScalar(meta.exportedAt)}`,
    "---",
  ].join("\n");
  const heading = `# 第 ${ch.order} 章 ${ch.title}`.trim();
  return `${front}\n\n${heading}\n\n${body}\n`;
}

function parseYamlValue(raw: string): string {
  const v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    try {
      return JSON.parse(v.startsWith("'") ? `"${v.slice(1, -1)}"` : v);
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
}

export function parseChapterMarkdown(md: string): {
  meta: Partial<ChapterFileMeta>;
  prose: string;
} {
  const text = md.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Partial<ChapterFileMeta> = {};
  let rest = text;
  if (m) {
    rest = text.slice(m[0].length).replace(/^\n/, "");
    for (const line of m[1].split("\n")) {
      const eq = line.indexOf(":");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = parseYamlValue(line.slice(eq + 1));
      if (key === "order") meta.order = Number(value) || 0;
      else if (key === "format")
        meta.format = value as ChapterFileMeta["format"];
      else if (key === "projectId") meta.projectId = value;
      else if (key === "chapterId") meta.chapterId = value;
      else if (key === "bookTitle") meta.bookTitle = value;
      else if (key === "chapterTitle") meta.chapterTitle = value;
      else if (key === "volumeId") meta.volumeId = value;
      else if (key === "volumeTitle") meta.volumeTitle = value;
      else if (key === "writingBoard")
        meta.writingBoard = value as NovelProject["writingBoard"];
      else if (key === "status")
        meta.status = value as ChapterFileMeta["status"];
      else if (key === "exportedAt") meta.exportedAt = value;
    }
  }
  const heading = rest.match(/^#\s+第\s*\d+\s*章[^\n]*\n+/);
  const prose = (heading ? rest.slice(heading[0].length) : rest).trim();
  return { meta, prose };
}

export function orderedOutlineChapters(project: NovelProject): OutlineChapter[] {
  return chaptersGroupedByVolume(project).flatMap((g) => g.chapters);
}

export function isFinishedChapter(
  project: NovelProject,
  chapterId: string
): boolean {
  const row = chapterRow(project, chapterId);
  if (!row || row.status !== "done") return false;
  return Boolean(row.content?.trim());
}

export function selectChaptersForRepoExport(
  project: NovelProject,
  mode: ChapterRepoExportMode,
  currentChapterId?: string
): OutlineChapter[] {
  const outline = orderedOutlineChapters(project);
  if (mode === "current") {
    const id = currentChapterId || "";
    const ch = outline.find((c) => c.id === id);
    if (!ch) throw new Error("请先选择要写入的章节");
    if (!chapterBody(project, ch.id).trim()) {
      throw new Error("本章尚无正文");
    }
    return [ch];
  }
  const done = outline.filter((ch) => isFinishedChapter(project, ch.id));
  if (!done.length) throw new Error("没有已完成且有正文的章节");
  return done;
}

export function buildChapterRepoFiles(
  project: NovelProject,
  chapters: OutlineChapter[],
  subdir?: string | null,
  exportedAt?: string
): ChapterRepoFile[] {
  return chapters.map((ch) => {
    const relativePath = chapterRepoRelativePath(project, ch, subdir);
    return {
      relativePath,
      fileName: chapterRepoFileName(ch),
      content: buildChapterMarkdown(project, ch, exportedAt),
      meta: buildChapterFileMeta(project, ch, exportedAt),
      chapterId: ch.id,
    };
  });
}

function downloadChapterRepoFiles(
  project: NovelProject,
  files: ChapterRepoFile[]
): ChapterRepoExportResult {
  const book = bookExportFolderName(project);
  if (files.length === 1) {
    const f = files[0];
    downloadBlob(
      new Blob([f.content], { type: "text/markdown;charset=utf-8" }),
      `${book}-${f.fileName}`
    );
    return {
      ok: true,
      via: "download",
      files: [f.relativePath],
      message: `浏览器无法写入文件夹，已下载 ${f.fileName}`,
    };
  }
  downloadBlob(
    createZip(files.map((f) => ({ name: f.relativePath, data: f.content }))),
    `${book}-chapters.zip`
  );
  return {
    ok: true,
    via: "download",
    files: files.map((f) => f.relativePath),
    message: `浏览器无法写入文件夹，已下载 ${files.length} 章压缩包（解压到所选目录即可）`,
  };
}

export async function pickChapterRepoRoot(): Promise<{
  ok: boolean;
  path?: string;
  canceled?: boolean;
  message: string;
}> {
  const bridge = getDesktop();
  if (!bridge?.pickDirectory) {
    return { ok: false, message: "仅桌面端可选择写入目录" };
  }
  const prefs = loadAppPrefs();
  let defaultPath = prefs.chapterRepoRoot || "";
  if (!defaultPath && bridge.getSuggestedExportRoot) {
    try {
      const suggested = await bridge.getSuggestedExportRoot();
      if (suggested.ok && suggested.path) defaultPath = suggested.path;
    } catch {
      /* ignore */
    }
  }
  const picked = await bridge.pickDirectory({
    title: "选择章节 Markdown 写入的文件夹",
    defaultPath: defaultPath || undefined,
  });
  if (!picked.ok || !picked.path) {
    return {
      ok: false,
      canceled: true,
      message: picked.message || "已取消",
    };
  }
  saveAppPrefs({ ...loadAppPrefs(), chapterRepoRoot: picked.path });
  return { ok: true, path: picked.path, message: "已保存导出根目录" };
}

export async function exportChaptersToRepo(
  project: NovelProject,
  options: {
    mode: ChapterRepoExportMode;
    currentChapterId?: string;
    root?: string;
    subdir?: string;
  }
): Promise<ChapterRepoExportResult> {
  const prefs = loadAppPrefs();
  const subdir =
    options.subdir !== undefined
      ? options.subdir
      : prefs.chapterExportSubdir ?? DEFAULT_CHAPTER_EXPORT_SUBDIR;
  const chapters = selectChaptersForRepoExport(
    project,
    options.mode,
    options.currentChapterId
  );
  const files = buildChapterRepoFiles(project, chapters, subdir);
  const desktop = isDesktopApp();
  const bridge = getDesktop();

  if (
    !desktop ||
    !bridge?.writeTextFiles ||
    typeof window === "undefined"
  ) {
    return downloadChapterRepoFiles(project, files);
  }

  let root = (options.root || prefs.chapterRepoRoot || "").trim();
  if (!root) {
    const picked = await pickChapterRepoRoot();
    if (!picked.ok || !picked.path) {
      return {
        ok: false,
        via: "desktop",
        files: [],
        message: picked.message || "未选择导出目录",
      };
    }
    root = picked.path;
  } else if (options.root && options.root !== prefs.chapterRepoRoot) {
    saveAppPrefs({ ...loadAppPrefs(), chapterRepoRoot: root });
  }
  if (options.subdir !== undefined && options.subdir !== prefs.chapterExportSubdir) {
    saveAppPrefs({ ...loadAppPrefs(), chapterExportSubdir: options.subdir });
  }

  const written = await bridge.writeTextFiles({
    root,
    files: files.map((f) => ({
      relativePath: f.relativePath,
      content: f.content,
    })),
  });
  if (!written.ok) {
    return {
      ok: false,
      via: "desktop",
      files: [],
      root,
      message: written.message || "写入失败",
    };
  }
  return {
    ok: true,
    via: "desktop",
    files: written.written?.length
      ? written.written
      : files.map((f) => f.relativePath),
    root,
    message: `已写入 ${files.length} 个文件（同一章再导出会覆盖）`,
  };
}
