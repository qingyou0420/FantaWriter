import type { ChapterReviewIssue, ReviewSeverity } from "./types";

export type ReviewDimensionId =
  | "hook_in"
  | "hook_out"
  | "outline_fit"
  | "state_continuity"
  | "motive"
  | "world_consistency"
  | "forbid"
  | "pacing"
  | "pov"
  | "diction"
  | string;

export type ReviewDimension = {
  id: ReviewDimensionId;
  label: string;
  weight: number;
  prompt: string;
};

const CORE_DIMENSIONS: ReviewDimension[] = [
  {
    id: "hook_in",
    label: "承接上章钩子",
    weight: 12,
    prompt: "本章开头是否兑现或有意识地延宕上章钩子，而不是另起炉灶。",
  },
  {
    id: "hook_out",
    label: "章末钩子落点",
    weight: 10,
    prompt: "章末是否留下可接的悬念或代价，而不是把气口泄尽。",
  },
  {
    id: "outline_fit",
    label: "大纲符合度",
    weight: 14,
    prompt: "对照本章大纲要点：该发生的是否发生，有无跑题或漏点。",
  },
  {
    id: "state_continuity",
    label: "人物状态连续性",
    weight: 14,
    prompt: "对照账本：称呼、伤势、位置有无无故重置或跳变。",
  },
  {
    id: "motive",
    label: "人物动机可信",
    weight: 10,
    prompt: "关键行动是否有本章内可见的动机，而不是作者强行推动。",
  },
  {
    id: "world_consistency",
    label: "世界设定一致",
    weight: 12,
    prompt: "对照世界条目与锁定事实，有无改写已锁定的硬设定。",
  },
  {
    id: "forbid",
    label: "禁写清单违规",
    weight: 10,
    prompt: "是否触碰全书或本章禁写清单。",
  },
  {
    id: "pacing",
    label: "节奏与信息密度",
    weight: 8,
    prompt: "信息是否过稀或过密，场景是否原地踏步。",
  },
  {
    id: "pov",
    label: "视角与人称",
    weight: 5,
    prompt: "人称与视角是否与设定一致，有无突然跳视角。",
  },
  {
    id: "diction",
    label: "语言重复/口头禅",
    weight: 5,
    prompt: "是否有明显套话、重复句式或人物口癖失控。",
  },
];

let extraDimensions: ReviewDimension[] = [];

export function listReviewDimensions(): ReviewDimension[] {
  return [...CORE_DIMENSIONS, ...extraDimensions];
}

export function resetReviewDimensions(): void {
  extraDimensions = [];
}

/** 加一维 = 加一条配置。测试用第 11 维走这条。 */
export function registerReviewDimension(dim: ReviewDimension): ReviewDimension[] {
  extraDimensions = extraDimensions.filter((d) => d.id !== dim.id).concat(dim);
  return listReviewDimensions();
}

export function buildReviewChapterPrompt(opts: {
  title: string;
  content: string;
  outlineSummary?: string;
  previousHook?: string;
  chapterHook?: string;
  forbidList?: string[];
  ledger?: string;
  world?: string;
  extraInstruction?: string;
}): { system: string; user: string } {
  const dims = listReviewDimensions();
  const dimBlock = dims
    .map((d, i) => `${i + 1}. [${d.id}] ${d.label}：${d.prompt}`)
    .join("\n");
  const system =
    "你是中文长篇小说审稿人。只输出 JSON，不要解释。字段：score(0-100), issues:[{dimension, severity:high|medium|low, title, evidence, suggestion, locatable}]。dimension 必须是给定 id。";
  const user = [
    `章题：${opts.title}`,
    opts.outlineSummary ? `本章大纲：${opts.outlineSummary}` : "",
    opts.previousHook ? `上章钩子：${opts.previousHook}` : "",
    opts.chapterHook ? `本章钩子：${opts.chapterHook}` : "",
    opts.forbidList?.length ? `禁写：${opts.forbidList.join("；")}` : "",
    opts.ledger ? `账本：\n${opts.ledger}` : "",
    opts.world ? `世界/锁定事实：\n${opts.world}` : "",
    `审稿维度：\n${dimBlock}`,
    opts.extraInstruction || "",
    "正文：",
    opts.content,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system, user };
}

export function scoreFromIssues(
  issues: ChapterReviewIssue[],
  dimensions: ReviewDimension[] = listReviewDimensions()
): number {
  const weightOf = (id: string) =>
    dimensions.find((d) => d.id === id)?.weight ?? 8;
  const sevMul: Record<ReviewSeverity, number> = {
    high: 1,
    medium: 0.55,
    low: 0.25,
  };
  let deduct = 0;
  for (const iss of issues) {
    deduct += weightOf(iss.dimension) * (sevMul[iss.severity] ?? 0.4);
  }
  return Math.max(0, Math.min(100, Math.round(100 - deduct)));
}

export function parseReviewPayload(raw: string): {
  score: number;
  issues: ChapterReviewIssue[];
} {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { score: 0, issues: [] };
  }
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      score?: number;
      issues?: Partial<ChapterReviewIssue>[];
    };
    const issues: ChapterReviewIssue[] = (obj.issues || [])
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        dimension: String(i.dimension || ""),
        severity: ((): ReviewSeverity => {
          if (i.severity === "high" || i.severity === "medium") return i.severity;
          return "low";
        })(),
        title: String(i.title || ""),
        evidence: String(i.evidence || ""),
        suggestion: String(i.suggestion || ""),
        locatable: Boolean(i.locatable ?? i.evidence),
      }))
      .filter((i) => i.title || i.evidence);
    const score =
      typeof obj.score === "number" && Number.isFinite(obj.score)
        ? Math.max(0, Math.min(100, Math.round(obj.score)))
        : scoreFromIssues(issues);
    return { score, issues };
  } catch {
    return { score: 0, issues: [] };
  }
}

/** 无 high 问题视为已审；有阻断问题保持 draft。跳过审稿不要走这里。 */
export function reviewStateAfterIssues(
  issues: { severity?: string }[] | undefined
): "draft" | "reviewed" {
  if ((issues || []).some((i) => i.severity === "high")) return "draft";
  return "reviewed";
}

export function locateEvidenceOffset(content: string, evidence: string): number {
  const hay = content || "";
  const needle = (evidence || "").trim();
  if (!needle) return -1;
  const exact = hay.indexOf(needle);
  if (exact >= 0) return exact;
  const short = needle.slice(0, 24);
  return short ? hay.indexOf(short) : -1;
}
