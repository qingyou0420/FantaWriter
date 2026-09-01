import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAuthoringState, recordPhaseVisit, applyGraphDelta } from "../interactive-film/authoring-store.js";
import { StoryGraphDeltaSchema } from "../interactive-film/delta.js";

describe("authoring-state phaseRevs (additive)", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "if-pr-")); await mkdir(join(root, "interactive-films", "p"), { recursive: true }); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("old state without phaseRevs still loads", async () => {
    const s = await loadAuthoringState(root, "p");
    expect(s.phaseRevs).toBeUndefined();
  });

  it("recordPhaseVisit stores current rev under the phase, preserving other fields", async () => {
    await applyGraphDelta({ projectRoot: root, projectId: "p", delta: StoryGraphDeltaSchema.parse({ worldAnchor: { storyCore: "X" } }), phase: "world" });
    await recordPhaseVisit(root, "p", "structure");
    const s = await loadAuthoringState(root, "p");
    expect(s.phase).toBe("world");          // preserved
    expect(s.phaseRevs?.structure).toBe(s.rev); // recorded current rev
  });

  it("recordPhaseVisit accumulates multiple phases without clobbering prior entries", async () => {
    await applyGraphDelta({ projectRoot: root, projectId: "p", delta: StoryGraphDeltaSchema.parse({ worldAnchor: { storyCore: "X" } }), phase: "world" });
    await recordPhaseVisit(root, "p", "structure");
    await applyGraphDelta({ projectRoot: root, projectId: "p", delta: StoryGraphDeltaSchema.parse({ worldAnchor: { storyCore: "Y" } }), phase: "world" });
    await recordPhaseVisit(root, "p", "workshop");
    const s = await loadAuthoringState(root, "p");
    expect(typeof s.phaseRevs?.structure).toBe("number"); // first visit still present
    expect(typeof s.phaseRevs?.workshop).toBe("number");  // second visit also present
    expect(s.phaseRevs?.workshop).toBeGreaterThan(s.phaseRevs?.structure as number); // workshop recorded at a later rev
  });
});
