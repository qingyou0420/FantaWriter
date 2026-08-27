import { describe, expect, it } from "vitest";
import { assemble } from "./prompts/registry";
import {
  buildChapterSummaryUserPrompt,
  buildConsistencyCheckUserPrompt,
} from "./prompts";
import { formatBeatContract, buildBeatContract } from "./beat-contract";
import { buildMemoryPack } from "./memory-pack";
import { formatCharacters } from "./prompts";
import {
  collectAuthorSecrets,
  flattenAuthorSecrets,
  secretHitsInText,
} from "./author-secrets";
import { chapterAssembleExtras } from "./chapter-contract";
import {
  formatCharacterStateLedger,
  mergeCharacterStates,
} from "./character-states";
import { applyPendingDeltasToLedger } from "./finalize-chapter";
import {
  createEmptyPlotThread,
  createEmptyProject,
  createEmptyTruthLayer,
  normalizeProject,
} from "./types";

const THEME = "THEME_SECRET_NEVER_INJECT_甲子钥";
const ENDING = "ENDING_SECRET_NEVER_INJECT_终局反转";
const CORE = "CONFLICT_SECRET_谁对谁不能和解";
const TRUTH_WANT = "TRUTH_SURFACE_他自以为要封号";
const TRUTH_NEED = "TRUTH_NEED_真正缺的是父亲承认";
const TRUTH_FLAW = "TRUTH_FLAW_护短到会毁掉自己";
const TRUTH_LINE = "TRUTH_LINE_绝不背叛师门";
const DARK_TITLE = "DARK_TITLE_铜铃旧城令";
const DARK_NOTE = "DARK_NOTE_血缘未揭读者不知";
const DEST = "DEST_NOTE_第三卷才收这条暗线";

function secretProject() {
  const p = createEmptyProject("红线");
  p.premiseCard = {
    premise: "行人甲要在霜桥交还铜铃",
    theme: THEME,
    endingDirection: ENDING,
    forbidList: ["主角不许黑化"],
    coreConflict: CORE,
  };
  p.characters[0] = {
    ...p.characters[0],
    id: "hero",
    name: "行人甲",
    speechStyle: "短句，少修饰。",
    notes: "公开备注可以注入",
    truth: {
      ...createEmptyTruthLayer(),
      surfaceWant: TRUTH_WANT,
      realNeed: TRUTH_NEED,
      fatalFlaw: TRUTH_FLAW,
      bottomLine: TRUTH_LINE,
    },
  };
  p.plotThreads = [
    {
      ...createEmptyPlotThread("渡口定约"),
      visibility: "reader_known",
      kind: "foreshadow",
      status: "active",
      note: "读者已知的钩子",
    },
    {
      ...createEmptyPlotThread(DARK_TITLE),
      visibility: "author_only",
      kind: "dark",
      status: "planted",
      note: DARK_NOTE,
      destinationNote: DEST,
    },
  ];
  const ch1 = {
    id: "c1",
    order: 1,
    title: "一",
    summary: "上路",
    keyPoints: "出城",
    tags: [] as string[],
    hook: "门后有人",
    castIds: ["hero"],
    forbidList: ["不得暗示血缘"],
    timePlace: "出城次日 · 霜桥",
    volumeId: p.volumes![0].id,
  };
  const ch2 = {
    id: "c2",
    order: 2,
    title: "二",
    summary: "上桥",
    keyPoints: "交铃",
    tags: [] as string[],
    hook: "铃未响",
    castIds: ["hero"],
    forbidList: [],
    timePlace: "当日黄昏 · 霜桥",
    volumeId: p.volumes![0].id,
  };
  p.outline = {
    premise: "行人甲要在霜桥交还铜铃",
    endingNote: ENDING,
    chapters: [ch1, ch2],
  };
  p.chapters = [
    {
      chapterId: "c1",
      title: "一",
      content: "他出了北城。",
      status: "done",
      updatedAt: "",
      summary: "离开北城。",
      pendingStateDeltas: [
        { name: "行人甲", injury: "PENDING_DELTA_左臂未愈" },
      ],
    },
  ];
  p.settings = { ...p.settings, serialMode: true };
  return normalizeProject(p);
}

function expectClean(label: string, text: string, secrets: string[]) {
  const hits = secretHitsInText(text, secrets);
  expect(hits, `${label} leaked ${hits.join(" | ")}`).toEqual([]);
}

describe("author-secret red line", () => {
  const project = secretProject();
  const secrets = flattenAuthorSecrets(collectAuthorSecrets(project));
  const extras = chapterAssembleExtras(project, project.outline!.chapters[1]);

  const common = {
    characters: project.characters,
    background: project.background,
    settings: project.settings,
    outline: project.outline,
    chapter: project.outline!.chapters[1],
    projectTags: [] as string[],
    premise: extras.premise,
    chapterContractBlock: extras.chapterContractBlock,
    injectFullOutline: extras.injectFullOutline,
    includeEndingDirection: false,
    endingDirection: project.premiseCard?.endingDirection,
    volume: project.volumes![0],
    previousEnding: "上卷终局：出城",
    chapterCount: 10,
    recentSummaries: [{ order: 1, title: "一", summary: "离开北城。" }],
    openThreads: ["- 渡口定约：读者已知的钩子"],
    seed: "一个走霜桥的人",
    character: project.characters[0],
    otherCharacters: [],
    existingText: "前文。",
    selectedText: "一段正文",
    rewriteMode: "polish",
    priorBlock: buildMemoryPack(project, 2).priorBlock,
    scene: { order: 1, title: "上桥", summary: "黎明" },
    chapterSummaries: [{ order: 1, title: "一", summary: "离开北城。" }],
  };

  const tasks = [
    "outline",
    "outline_volume",
    "outline_next",
    "chapter",
    "continue",
    "rewrite",
    "scene_plan",
    "scene_chapter",
    "expand_character",
    "optimize_character",
    "expand_background",
    "optimize_background",
    "expand_cast",
    "polish_chapter_outline",
    "volume_summary",
  ] as const;

  it("collects every red-line field", () => {
    expect(secrets).toEqual(
      expect.arrayContaining([
        THEME,
        ENDING,
        CORE,
        TRUTH_WANT,
        TRUTH_NEED,
        TRUTH_FLAW,
        TRUTH_LINE,
        DARK_TITLE,
        DARK_NOTE,
        DEST,
      ])
    );
  });

  it("keeps red-line fields out of every assemble path", () => {
    for (const task of tasks) {
      const { system, user } = assemble(task, "general", { ...common });
      expectClean(task, `${system}\n${user}`, secrets);
    }
  });

  it("keeps red-line fields out of chapter summary and consistency prompts", () => {
    const summary = buildChapterSummaryUserPrompt({
      content: "他出了北城。",
      title: "一",
      openThreads: ["渡口定约"],
      serialMode: true,
    });
    expectClean("chapter_summary", summary, secrets);

    const consistency = buildConsistencyCheckUserPrompt({
      characters: project.characters,
      background: project.background,
      chapters: [{ order: 1, title: "一", summary: "离开北城。" }],
    });
    expectClean("consistency_check", consistency, secrets);
  });

  it("does not inject endingNote into chapter or continue prompts", () => {
    const ch = assemble("chapter", "general", { ...common });
    expect(ch.user).not.toContain("结局走向：");
    expect(ch.user).toContain("行人甲要在霜桥交还铜铃");
    expect(ch.user).toContain("禁止写：主角不许黑化");
    expect(ch.user).toContain("本章契约");

    const on = assemble("chapter", "general", {
      ...common,
      includeEndingDirection: true,
      endingDirection: ENDING,
    });
    expect(on.user).toContain(ENDING);
  });

  it("strips author-only threads from beat contract and memory pack", () => {
    const contract = buildBeatContract({
      threads: project.plotThreads,
      scene: { threadIds: [], verbatimAnchors: [] },
    });
    const block = formatBeatContract(contract, project.plotThreads);
    expectClean("beat-contract", block, [DARK_TITLE, DARK_NOTE]);

    const pack = buildMemoryPack(project, 2);
    expectClean("memory-pack", pack.priorBlock, [DARK_TITLE, DARK_NOTE, DEST]);
    expect(pack.plotThreads).toContain("渡口定约");
  });

  it("never prints truth layer from formatCharacters", () => {
    const text = formatCharacters(project.characters);
    expectClean("formatCharacters", text, [
      TRUTH_WANT,
      TRUTH_NEED,
      TRUTH_FLAW,
      TRUTH_LINE,
    ]);
    expect(text).toContain("短句，少修饰");
  });

  it("does not put pending ledger deltas into the next chapter memory pack", () => {
    const pack = buildMemoryPack(project, 2);
    expect(pack.priorBlock).not.toContain("PENDING_DELTA_左臂未愈");
    const confirmed = applyPendingDeltasToLedger(
      project.characterStates,
      1,
      project.chapters[0].pendingStateDeltas || []
    );
    const after = buildMemoryPack(
      { ...project, characterStates: confirmed },
      2
    );
    expect(after.characterStateCard).toContain("PENDING_DELTA_左臂未愈");
  });

  it("keeps pinned ledger notes after many unpinned merges", () => {
    let ledger = mergeCharacterStates(
      {},
      1,
      [{ name: "行人甲", injury: "PINNED_左臂未愈不能持重剑" }]
    );
    ledger = {
      行人甲: ledger.行人甲.map((n) => ({ ...n, pinned: true })),
    };
    for (let i = 2; i <= 22; i++) {
      ledger = mergeCharacterStates(ledger, i, [
        { name: "行人甲", location: `日常增量${i}` },
      ]);
    }
    const names = ["行人甲"];
    const card = formatCharacterStateLedger(ledger, names, 3);
    expect(card).toContain("PINNED_左臂未愈不能持重剑");
    expect(card).not.toContain("日常增量3");
    expect(card).toContain("日常增量22");
  });
});
