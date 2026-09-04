export type ShortFictionStageStatus = "pending" | "active" | "completed";

export interface ShortFictionStage {
  readonly label: string;
  readonly status: ShortFictionStageStatus;
}

export type ShortFictionPhase = "outline" | "draft" | "full";
export type ShortFictionStageLanguage = "zh" | "en";

function pick(lang: ShortFictionStageLanguage, zh: string, en: string): string {
  return lang === "en" ? en : zh;
}

export function shortFictionWriteLabel(lang: ShortFictionStageLanguage, chapter?: number): string {
  if (chapter && chapter > 0) {
    return pick(lang, `写第 ${chapter} 章`, `Write chapter ${chapter}`);
  }
  return pick(lang, "写章", "Write chapters");
}

export function shortFictionToolStages(
  phase: ShortFictionPhase | undefined,
  _chapterCount: number,
  lang: ShortFictionStageLanguage,
): ShortFictionStage[] {
  const outline = [
    { zh: "创建大纲", en: "Create outline" },
    { zh: "审大纲", en: "Review outline" },
    { zh: "改大纲", en: "Revise outline" },
  ];
  const draft = [
    { zh: "写章", en: "Write chapters" },
    { zh: "审稿", en: "Review" },
    { zh: "修订", en: "Revise" },
    { zh: "封面", en: "Cover" },
  ];
  const labels = phase === "draft" ? draft : phase === "outline" ? outline : [...outline, ...draft];
  return labels.map((label, index) => ({
    label: pick(lang, label.zh, label.en),
    status: index === 0 ? "active" : "pending",
  }));
}

export function isShortFictionWriteStage(label: string): boolean {
  return /写第\s*\d+\s*章|写章|Write chapter|Write chapters/i.test(label);
}

export function currentShortFictionStage(
  stages: ReadonlyArray<ShortFictionStage> | undefined,
): ShortFictionStage | undefined {
  return stages?.find((stage) => stage.status === "active")
    ?? stages?.find((stage) => stage.status === "pending");
}

export function normalizeToolStartStages(raw: unknown, tool: string): ShortFictionStage[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const stages: ShortFictionStage[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      stages.push({ label: item, status: "pending" });
      continue;
    }
    if (item && typeof item === "object" && typeof (item as { label?: unknown }).label === "string") {
      const status = (item as { status?: unknown }).status;
      stages.push({
        label: (item as { label: string }).label,
        status: status === "active" || status === "completed" ? status : "pending",
      });
    }
  }
  if (stages.length === 0) return undefined;
  if (tool === "short_fiction_run" && stages.every((stage) => stage.status === "pending")) {
    return stages.map((stage, index) => (index === 0 ? { ...stage, status: "active" } : stage));
  }
  return stages;
}

function findStageIndex(
  stages: ReadonlyArray<ShortFictionStage>,
  matcher: (label: string) => boolean,
): number {
  return stages.findIndex((stage) => matcher(stage.label));
}

export function advanceShortFictionStages(
  stages: ReadonlyArray<ShortFictionStage> | undefined,
  message: string,
  lang: ShortFictionStageLanguage = "zh",
): ShortFictionStage[] | undefined {
  if (!stages || stages.length === 0) return stages as ShortFictionStage[] | undefined;
  const text = message.trim();
  if (!text) return [...stages];

  if (/已从磁盘恢复大纲|Resuming from the locked outline/i.test(text)) {
    return stages.map((stage) => (
      /大纲|outline/i.test(stage.label) ? { ...stage, status: "completed" as const } : stage
    ));
  }

  const chapterMatch = text.match(/第\s*(\d+)\s*章/) ?? text.match(/chapter\s+(\d+)/i);
  const chapterNumber = chapterMatch ? Number(chapterMatch[1]) : undefined;
  const totalMatch = text.match(/[（(]\s*(\d+)\s*\/\s*(\d+)\s*[）)]/);
  const total = totalMatch ? Number(totalMatch[2]) : undefined;
  const completedChapter = /已写完|written/i.test(text) && chapterNumber !== undefined;

  let targetIndex = -1;
  let nextLabel: string | undefined;
  let completeTarget = false;

  if (chapterNumber !== undefined) {
    targetIndex = findStageIndex(stages, isShortFictionWriteStage);
    if (targetIndex >= 0) {
      nextLabel = shortFictionWriteLabel(lang, chapterNumber);
      completeTarget = Boolean(completedChapter && total !== undefined && chapterNumber === total);
    }
  } else if (/撰写短篇大纲|创建大纲|Writing the short-fiction outline|Creating the outline/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /创建大纲|撰写大纲|Create outline|Write outline/i.test(label));
  } else if (/审阅大纲|审大纲|Reviewing the outline/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /审大纲|审阅大纲|Review outline/i.test(label));
  } else if (/修订大纲|改大纲|Revising the outline/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /改大纲|修订大纲|Revise outline/i.test(label));
  } else if (/锁定|locked/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /改大纲|修订大纲|Revise outline/i.test(label));
    completeTarget = targetIndex >= 0;
  } else if (/审阅全文|审稿|Reviewing the full draft/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /审稿|审阅全文|Review draft|^Review$/i.test(label));
  } else if (/修订全文|Revising the full draft/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /修订(?!大纲)|修订全文|^Revise$|Revise draft/i.test(label));
  } else if (/简介|synopsis|封面|cover prompt|Package/i.test(text)) {
    targetIndex = findStageIndex(stages, (label) => /封面|简介|Package|Cover/i.test(label));
  } else if (/已从磁盘恢复各章|Resuming from chapters/i.test(text)) {
    targetIndex = findStageIndex(stages, isShortFictionWriteStage);
  }

  if (targetIndex < 0) return [...stages];

  return stages.map((stage, index) => {
    const label = index === targetIndex && nextLabel ? nextLabel : stage.label;
    if (index < targetIndex || (completeTarget && index === targetIndex)) {
      return { label, status: "completed" as const };
    }
    if (index === targetIndex) {
      return { label, status: "active" as const };
    }
    return stage.status === "active" ? { ...stage, status: "pending" as const } : stage;
  });
}
