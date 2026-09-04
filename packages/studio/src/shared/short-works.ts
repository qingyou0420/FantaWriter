export type StudioShortStatus = "completed" | "outlining" | "drafting" | "failed";
export type StudioShortContentKind = "manuscript" | "draft" | "outline";

export interface StudioShortSummary {
  readonly id: string;
  readonly title: string;
  readonly status: StudioShortStatus;
  readonly stage?: string;
  readonly chapterCount?: number;
  readonly manuscriptPath: string;
  readonly coverImagePath?: string;
  readonly kind: "short";
}

export interface StudioShortDetail extends StudioShortSummary {
  readonly content: string;
  readonly contentKind: StudioShortContentKind;
}
