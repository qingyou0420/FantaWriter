import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { toPosixPath } from "../utils/posix-path.js";
import { extractTranslationSource } from "./source.js";
import { segmentTranslationText } from "./text.js";
import type {
  CreateTranslationProjectInput,
  TranslationChapterFile,
  TranslationChapterManifest,
  TranslationProjectCreateResult,
  TranslationProjectManifest,
} from "./types.js";

export async function createTranslationProjectFromFile(
  projectRoot: string,
  input: CreateTranslationProjectInput,
): Promise<TranslationProjectCreateResult> {
  const source = await extractTranslationSource(projectRoot, input);
  const now = new Date().toISOString();
  const id = `${now.replace(/[:.]/g, "-")}-${slug(source.title)}`;
  const projectDirAbs = join(projectRoot, "translations", id);
  const sourceDirAbs = join(projectDirAbs, "source");
  const translatedDirAbs = join(projectDirAbs, "translated");
  await mkdir(sourceDirAbs, { recursive: true });
  await mkdir(translatedDirAbs, { recursive: true });

  const chapters: TranslationChapterManifest[] = [];
  for (const [index, chapter] of source.chapters.entries()) {
    const number = index + 1;
    const sourceChapterAbs = join(sourceDirAbs, `chapter-${number.toString().padStart(4, "0")}.json`);
    const translatedChapterAbs = join(translatedDirAbs, `chapter-${number.toString().padStart(4, "0")}.json`);
    const segments = segmentTranslationText(chapter.content, input.segmentMaxChars).map((segment, segmentIndex) => ({
      index: segmentIndex + 1,
      source: segment,
    }));
    const chapterFile: TranslationChapterFile = {
      number,
      title: chapter.title,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      segments,
    };
    await writeFile(sourceChapterAbs, JSON.stringify(chapterFile, null, 2), "utf-8");
    await writeFile(translatedChapterAbs, JSON.stringify({ ...chapterFile, segments: [] }, null, 2), "utf-8");
    chapters.push({
      number,
      title: chapter.title,
      sourcePath: toPosixPath(relative(projectRoot, sourceChapterAbs)),
      translatedPath: toPosixPath(relative(projectRoot, translatedChapterAbs)),
      segmentCount: segments.length,
      charCount: chapter.content.length,
      status: "pending",
    });
  }

  const manifest: TranslationProjectManifest = {
    id,
    title: input.title?.trim() || source.title,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    createdAt: now,
    updatedAt: now,
    source: {
      kind: source.kind,
      path: source.sourcePath,
      charCount: source.charCount,
      ...(source.totalPages !== undefined ? { totalPages: source.totalPages } : {}),
    },
    chapters,
  };
  const manifestPathAbs = join(projectDirAbs, "manifest.json");
  await writeFile(manifestPathAbs, JSON.stringify(manifest, null, 2), "utf-8");
  await writeFile(join(projectDirAbs, "glossary.json"), JSON.stringify({ terms: [] }, null, 2), "utf-8");
  await writeFile(join(projectDirAbs, "review-report.md"), "# Translation Review\n\nPending.\n", "utf-8");

  return {
    projectDir: toPosixPath(relative(projectRoot, projectDirAbs)),
    manifestPath: toPosixPath(relative(projectRoot, manifestPathAbs)),
    manifest,
  };
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "translation";
}
