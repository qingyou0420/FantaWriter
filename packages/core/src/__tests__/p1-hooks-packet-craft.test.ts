import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { overdueHookAuditIssues, classifyHookDue, selectDueHooks } from "../utils/hook-overdue.js";
import { buildGovernedPacketSnapshot, writeGovernedPacketSnapshot } from "../utils/packet-snapshot.js";
import { validatePostWrite } from "../agents/post-write-validator.js";
import { matchCraftPatterns } from "../craft/load-craft-rules.js";
import type { GenreProfile } from "../models/genre-profile.js";
import type { ChapterTrace, ContextPackage, RuleStack } from "../models/input-governance.js";

const profile: GenreProfile = {
  id: "test",
  name: "测试",
  language: "zh",
  chapterTypes: [],
  fatigueWords: [],
  pacingRule: "",
  numericalSystem: false,
  powerScaling: false,
  eraResearch: false,
  auditDimensions: [],
  satisfactionTypes: [],
};

describe("P1 hooks / packet / craft", () => {
  const temps: string[] = [];
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("marks overdue hooks critical", () => {
    const hooks = [
      { hookId: "H01", startChapter: 1, status: "open", targetChapter: 3, notes: "" },
      { hookId: "H02", startChapter: 1, status: "resolved", targetChapter: 2, notes: "" },
    ];
    expect(classifyHookDue(hooks[0]!, 4)).toBe("overdue");
    expect(selectDueHooks(hooks, 4)).toHaveLength(1);
    const issues = overdueHookAuditIssues(hooks, 4);
    expect(issues[0]?.severity).toBe("critical");
    expect(issues[0]?.category).toBe("hook-debt");
  });

  it("writes a packet snapshot with protected sources untruncated", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-g2-"));
    temps.push(root);
    await mkdir(root, { recursive: true });
    const contextPackage: ContextPackage = {
      chapter: 1,
      selectedContext: [
        { source: "story/author_intent.md", reason: "direction", excerpt: "FULL INTENT TEXT THAT MUST STAY" },
        { source: "story/chapter_summaries.md#1", reason: "history", excerpt: "old" },
      ],
    };
    const ruleStack: RuleStack = {
      layers: [],
      sections: { hard: [], soft: [], diagnostic: [] },
      overrideEdges: [],
      activeOverrides: [],
    };
    const trace: ChapterTrace = {
      chapter: 1,
      plannerInputs: [],
      composerInputs: [],
      selectedSources: contextPackage.selectedContext.map((entry) => entry.source),
      promptPacks: [],
      contextTiers: {
        protectedSources: ["story/author_intent.md"],
        compressibleSources: ["story/chapter_summaries.md#1"],
      },
      tokenBudget: { protectedTokens: 10, compressibleTokens: 2, totalSelectedTokens: 12 },
      notes: [],
    };
    const path = await writeGovernedPacketSnapshot({
      runtimeDir: root,
      chapterNumber: 1,
      contextPackage,
      ruleStack,
      trace,
    });
    const raw = JSON.parse(await readFile(path, "utf-8")) as ReturnType<typeof buildGovernedPacketSnapshot>;
    expect(raw.protectedNeverTruncated).toBe(true);
    const intent = raw.sources.find((source) => source.source === "story/author_intent.md");
    expect(intent?.truncated).toBe(false);
    expect(intent?.excerpt).toBe("FULL INTENT TEXT THAT MUST STAY");
  });

  it("flags OpenWrite-derived craft bans including 不是…而是…", () => {
    const hits = matchCraftPatterns("他不是在逃，而是在找一个能把账本藏住的角落。", "zh");
    expect(hits.some((hit) => hit.id === "not-but")).toBe(true);
    const violations = validatePostWrite(
      "空气仿佛凝固。他倒吸一口凉气，目光深邃。",
      profile,
      null,
    );
    expect(violations.some((item) => item.severity === "error")).toBe(true);
  });
});
