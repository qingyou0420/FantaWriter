import { buildBookProgress, countChars } from "./progress";
import type { NovelProject } from "./types";
import { listReviewDimensions } from "./review-registry";

export type AssetReadiness = {
  id: string;
  label: string;
  ready: boolean;
};

export type OverviewStats = {
  wordCount: number;
  chapterCount: number;
  writtenCount: number;
  characterCount: number;
  openThreadCount: number;
  pendingReviewCount: number;
  targetWords: number;
  percentOfTarget: number;
  assets: AssetReadiness[];
  assetReady: number;
  assetTotal: number;
  recent: {
    chapterId: string;
    order: number;
    title: string;
    words: number;
    score: number | null;
    reviewLabel: string;
  }[];
  nextHint: string;
};

export function buildOverviewStats(project: NovelProject): OverviewStats {
  const progress = buildBookProgress(project);
  const targetWords =
    project.wordTargets?.book ||
    progress.targetTotal ||
    progress.totalChapters * (progress.rows[0]?.target || 0);
  const characterCount = (project.characters || []).filter((c) =>
    c.name.trim()
  ).length;
  const openThreadCount = (project.plotThreads || []).filter(
    (t) => t.status !== "resolved"
  ).length;
  const pendingReviewCount = project.chapters.filter(
    (c) => c.content?.trim() && c.reviewState !== "reviewed"
  ).length;
  const assets: AssetReadiness[] = [
    {
      id: "intent",
      label: "作者意图",
      ready: Boolean(
        (project.premiseCard?.premise || project.outline?.premise || "").trim()
      ),
    },
    {
      id: "focus",
      label: "创作罗盘",
      ready: Boolean(project.currentFocus?.stageGoal?.trim()),
    },
    {
      id: "foundation",
      label: "故事基础",
      ready: Boolean(
        (project.background.synopsis || project.background.setting || "").trim()
      ),
    },
    {
      id: "cast",
      label: "人物",
      ready: characterCount > 0,
    },
    {
      id: "world",
      label: "世界设定",
      ready: Boolean((project.lore || []).length || (project.canon || []).length),
    },
    {
      id: "outline",
      label: "大纲",
      ready: Boolean(project.outline?.chapters?.length),
    },
  ];
  const recent = [...(project.outline?.chapters || [])]
    .sort((a, b) => a.order - b.order)
    .filter((ch) =>
      project.chapters.some((c) => c.chapterId === ch.id && c.content?.trim())
    )
    .slice(-5)
    .reverse()
    .map((ch) => {
      const row = project.chapters.find((c) => c.chapterId === ch.id);
      const review = (project.reviews || []).find((r) => r.chapterId === ch.id);
      const reviewLabel =
        row?.reviewState === "reviewed"
          ? review?.source === "legacy_reviewed" || !review
            ? "已审（旧流程）"
            : `已审 ${review.score}`
          : row?.content?.trim()
            ? "待审"
            : "未写";
      return {
        chapterId: ch.id,
        order: ch.order,
        title: ch.title,
        words: countChars(row?.content || ""),
        score: review?.score ?? null,
        reviewLabel,
      };
    });

  let nextHint = "先在资料库确认意图与人物，再去大纲排章。";
  if (!assets.find((a) => a.id === "outline")?.ready) {
    nextHint = "还没有大纲。到大纲工作区让织卷起草，确认后再写。";
  } else if (progress.doneChapters < progress.totalChapters) {
    nextHint = "点右上角「写下一章」，走写前检查 → 落墨 → 审稿 → 结算。";
  } else if (pendingReviewCount) {
    nextHint = `还有 ${pendingReviewCount} 章待审，到审稿工作区处理。`;
  } else {
    nextHint = "本轮章已写完。可续排大纲，或到工具与设置导出。";
  }

  return {
    wordCount: progress.totalWords,
    chapterCount: progress.totalChapters,
    writtenCount: progress.doneChapters,
    characterCount,
    openThreadCount,
    pendingReviewCount,
    targetWords,
    percentOfTarget: targetWords
      ? Math.min(999, Math.round((progress.totalWords / targetWords) * 100))
      : progress.percentOfTarget,
    assets,
    assetReady: assets.filter((a) => a.ready).length,
    assetTotal: assets.length,
    recent,
    nextHint,
  };
}

export function reviewDimensionCount(): number {
  return listReviewDimensions().length;
}
