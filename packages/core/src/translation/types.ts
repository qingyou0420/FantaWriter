export type TranslationSourceKind = "text" | "markdown" | "pdf" | "epub";
export type TranslationExportFormat = "txt" | "md" | "epub";

export interface CreateTranslationProjectInput {
  readonly filePath: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly title?: string;
  readonly segmentMaxChars?: number;
}

export interface TranslationSourceManifest {
  readonly kind: TranslationSourceKind;
  readonly path: string;
  readonly charCount: number;
  readonly totalPages?: number;
}

export interface TranslationChapterManifest {
  readonly number: number;
  readonly title: string;
  readonly sourcePath: string;
  readonly translatedPath: string;
  readonly segmentCount: number;
  readonly charCount: number;
  readonly status: "pending" | "translated" | "reviewed";
}

export interface TranslationProjectManifest {
  readonly id: string;
  readonly title: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly source: TranslationSourceManifest;
  readonly chapters: ReadonlyArray<TranslationChapterManifest>;
}

export interface TranslationSegment {
  readonly index: number;
  readonly source: string;
  readonly target?: string;
  readonly notes?: string;
}

export interface TranslationChapterFile {
  readonly number: number;
  readonly title: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly segments: ReadonlyArray<TranslationSegment>;
}

export interface TranslationProjectCreateResult {
  readonly projectDir: string;
  readonly manifestPath: string;
  readonly manifest: TranslationProjectManifest;
}

export interface TranslationGlossaryTerm {
  readonly source: string;
  readonly target: string;
  readonly note?: string;
}

export interface TranslationModelPort {
  readonly translateSegments: (input: {
    readonly sourceLanguage: string;
    readonly targetLanguage: string;
    readonly chapterTitle: string;
    readonly segments: ReadonlyArray<TranslationSegment>;
    readonly glossary: ReadonlyArray<TranslationGlossaryTerm>;
  }) => Promise<{
    readonly segments: ReadonlyArray<{
      readonly index: number;
      readonly target: string;
      readonly notes?: string;
    }>;
    readonly glossary?: ReadonlyArray<TranslationGlossaryTerm>;
  }>;
  readonly reviewChapter?: (input: {
    readonly sourceLanguage: string;
    readonly targetLanguage: string;
    readonly chapterTitle: string;
    readonly segments: ReadonlyArray<TranslationSegment>;
    readonly glossary: ReadonlyArray<TranslationGlossaryTerm>;
  }) => Promise<{
    readonly passed: boolean;
    readonly summary: string;
    readonly issues: ReadonlyArray<string>;
  }>;
}

export interface RunTranslationProjectResult {
  readonly projectId: string;
  readonly translatedSegments: number;
  readonly reviewedChapters: number;
  readonly reportPath: string;
}

export interface TranslationExportResult {
  readonly outputPath: string;
  readonly format: TranslationExportFormat;
  readonly chaptersExported: number;
}
