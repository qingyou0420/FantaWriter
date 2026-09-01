import { readFile } from "node:fs/promises";
import { basename, extname, relative } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { safeChildPath } from "../utils/path-safety.js";
import { toPosixPath } from "../utils/posix-path.js";
import { extractEpub } from "./epub.js";
import { normalizeTranslationText, splitTranslationChapters, type TranslationTextChapter } from "./text.js";
import type { CreateTranslationProjectInput, TranslationSourceKind } from "./types.js";

export interface ExtractedTranslationSource {
  readonly title: string;
  readonly kind: TranslationSourceKind;
  readonly sourcePath: string;
  readonly charCount: number;
  readonly totalPages?: number;
  readonly chapters: ReadonlyArray<TranslationTextChapter>;
}

const MAX_INPUT_BYTES = 80 * 1024 * 1024;

export async function extractTranslationSource(
  projectRoot: string,
  input: CreateTranslationProjectInput,
): Promise<ExtractedTranslationSource> {
  const safePath = safeChildPath(projectRoot, input.filePath);
  const buffer = await readFile(safePath);
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`Translation input is too large (${buffer.byteLength} bytes).`);
  }
  const sourcePath = toPosixPath(relative(projectRoot, safePath));
  const filename = basename(safePath);
  const ext = extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = normalizeTranslationText(extracted.text);
    if (!text) throw new Error("PDF text extraction returned no text. Scanned PDFs require OCR and are not supported yet.");
    return {
      title: input.title?.trim() || titleFromFilename(filename),
      kind: "pdf",
      sourcePath,
      charCount: text.length,
      totalPages: extracted.totalPages,
      chapters: splitTranslationChapters(text),
    };
  }

  if (ext === ".epub") {
    const epub = await extractEpub(buffer);
    const chapters = epub.chapters.map((chapter) => ({
      title: chapter.title,
      content: chapter.content,
    }));
    return {
      title: input.title?.trim() || epub.title || titleFromFilename(filename),
      kind: "epub",
      sourcePath,
      charCount: chapters.reduce((sum, chapter) => sum + chapter.content.length, 0),
      chapters,
    };
  }

  if (isTextExt(ext)) {
    const text = normalizeTranslationText(buffer.toString("utf-8"));
    return {
      title: input.title?.trim() || titleFromFilename(filename),
      kind: ext === ".md" || ext === ".markdown" ? "markdown" : "text",
      sourcePath,
      charCount: text.length,
      chapters: splitTranslationChapters(text),
    };
  }

  throw new Error(`Unsupported translation input type: ${ext || filename}`);
}

function isTextExt(ext: string): boolean {
  return [".txt", ".md", ".markdown"].includes(ext);
}

function titleFromFilename(filename: string): string {
  const ext = extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}
