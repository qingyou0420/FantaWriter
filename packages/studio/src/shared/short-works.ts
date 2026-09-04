export type StudioShortStatus = "completed" | "outlining" | "drafting" | "failed";
export type StudioShortContentKind = "manuscript" | "draft" | "outline";

export interface StudioShortSummary {
  readonly id: string;
  readonly title: string;
  readonly status: StudioShortStatus;
  readonly stage?: string;
  readonly chapterCount?: number;
  readonly direction?: string;
  readonly manuscriptPath: string;
  readonly coverImagePath?: string;
  readonly kind: "short";
}

export interface StudioShortDetail extends StudioShortSummary {
  readonly content: string;
  readonly contentKind: StudioShortContentKind;
}

/**
 * 「我的创作」 shorts come only from GET /shorts (disk under shorts/).
 * Session jsonl / task short_fiction_created details must not appear here.
 */
export function selectWorksListShorts(
  payload: { readonly shorts?: ReadonlyArray<StudioShortSummary> } | null | undefined,
): ReadonlyArray<StudioShortSummary> {
  return payload?.shorts ?? [];
}
