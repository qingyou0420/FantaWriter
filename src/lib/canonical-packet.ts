import {
  buildChapterContractFromProject,
  chapterAssembleExtras,
} from "./chapter-contract";
import { injectablePremise } from "./author-secrets";
import { buildMemoryPack } from "./memory-pack";
import { formatLoreBlock, selectLoreForPrompt } from "./lore";
import type { NovelProject, OutlineChapter } from "./types";

export type CanonicalPacket = {
  authorIntent: string;
  currentFocus: string;
  outlineWindow: string;
  previousTail: string;
  summaries: string;
  castCard: string;
  world: string;
  threads: string;
  previousHook: string;
  chapterGuide: string;
  priorBlock: string;
};

function outlineWindow(
  project: NovelProject,
  current: OutlineChapter | undefined
): string {
  if (!current) return "";
  const chs = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  const volId = current.volumeId || project.volumes?.[0]?.id;
  const inVol = chs.filter((c) => (c.volumeId || project.volumes?.[0]?.id) === volId);
  const idx = inVol.findIndex((c) => c.id === current.id);
  const slice = inVol.slice(Math.max(0, idx - 2), idx + 3);
  const vol = (project.volumes || []).find((v) => v.id === volId);
  const lines = [
    vol ? `本卷《${vol.title}》${vol.arcGoal ? ` · ${vol.arcGoal}` : ""}` : "",
    ...slice.map((c) => {
      const mark = c.id === current.id ? "（本章）" : "";
      return `第${c.order}章《${c.title}》${mark}：${c.summary || "（无大纲）"}`;
    }),
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildCanonicalPacket(
  project: NovelProject,
  currentOrder: number,
  opts?: { chapterText?: string }
): CanonicalPacket {
  const current = [...(project.outline?.chapters || [])].find(
    (c) => c.order === currentOrder
  );
  const pack = buildMemoryPack(project, currentOrder, {
    chapterText: opts?.chapterText,
  });
  const extras = current
    ? chapterAssembleExtras(project, current)
    : { chapterContractBlock: "" };
  const intent = injectablePremise(project.premiseCard, project.outline);
  const focus = project.currentFocus
    ? [
        project.currentFocus.stageGoal,
        project.currentFocus.mustKeep.length
          ? `必须保留：${project.currentFocus.mustKeep.join("；")}`
          : "",
        project.currentFocus.mustAvoid.length
          ? `必须避免：${project.currentFocus.mustAvoid.join("；")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const worldEntries = selectLoreForPrompt(
    project,
    opts?.chapterText || current?.summary || ""
  );
  const world = [
    formatLoreBlock(worldEntries),
    (project.canon || [])
      .filter((f) => f.locked)
      .map((f) => `- [锁定] ${f.name}：${f.statement}`)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
  const chapterGuide = current
    ? buildChapterContractFromProject(project, current)
    : "";
  const parts = [
    intent && `## 作者意图\n${intent}`,
    focus && `## 创作罗盘\n${focus}`,
    outlineWindow(project, current) &&
      `## 滚动大纲窗\n${outlineWindow(project, current)}`,
    pack.priorBlock,
    extras.chapterContractBlock &&
      `## 本章指导\n${extras.chapterContractBlock}`,
  ].filter(Boolean);

  return {
    authorIntent: intent,
    currentFocus: focus,
    outlineWindow: outlineWindow(project, current),
    previousTail: pack.previousSnippet || "",
    summaries: pack.previousSummaries,
    castCard: pack.characterStateCard,
    world,
    threads: pack.plotThreads,
    previousHook: (() => {
      const prev = [...(project.outline?.chapters || [])]
        .filter((c) => c.order < currentOrder)
        .sort((a, b) => a.order - b.order)
        .at(-1);
      return prev?.hook?.trim() || "";
    })(),
    chapterGuide,
    priorBlock: parts.join("\n\n"),
  };
}

/** 写章请求体用的上下文块，与助手栏 dry-run 同一装配器。 */
export function chapterPromptContext(
  project: NovelProject,
  currentOrder: number,
  opts?: { chapterText?: string }
) {
  const packet = buildCanonicalPacket(project, currentOrder, opts);
  return {
    previousChapterSnippet: packet.previousTail,
    previousSummaries: packet.summaries,
    previousSummary: packet.summaries,
    characterStateCard: packet.castCard,
    priorBlock: packet.priorBlock,
    plotThreads: packet.threads,
    lore: packet.world,
  };
}

export function previewCanonicalPacket(
  project: NovelProject,
  chapterId?: string | null
): CanonicalPacket | null {
  const chs = [...(project.outline?.chapters || [])].sort(
    (a, b) => a.order - b.order
  );
  const current =
    (chapterId && chs.find((c) => c.id === chapterId)) || chs[0];
  if (!current) return null;
  return buildCanonicalPacket(project, current.order);
}
