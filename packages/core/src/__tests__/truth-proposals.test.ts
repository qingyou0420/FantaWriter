import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWriteTruthFileTool } from "../agent/agent-tools.js";
import {
  applyTruthProposal,
  contentRevision,
  listTruthProposals,
  stageTruthProposal,
  TruthRevisionConflictError,
} from "../interaction/truth-proposals.js";
import { classifyTruthAuthority } from "../interaction/truth-authority.js";

describe("G3 canon diff proposals", () => {
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("classifies outline and roles as foundation", () => {
    expect(classifyTruthAuthority("outline/volume_map.md")).toBe("foundation");
    expect(classifyTruthAuthority("roles/主要角色/林砚.md")).toBe("foundation");
    expect(classifyTruthAuthority("author_intent.md")).toBe("direction");
    expect(classifyTruthAuthority("current_state.md")).toBe("runtime-truth");
  });

  it("stages write_truth_file for canon files and does not write until apply", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-g3-"));
    temps.push(root);
    const bookDir = join(root, "books", "harbor");
    await mkdir(join(bookDir, "story", "outline"), { recursive: true });
    await writeFile(join(bookDir, "story", "outline", "story_frame.md"), "# Story Frame\n\nOld.\n", "utf-8");

    const tool = createWriteTruthFileTool({} as never, root, "harbor");
    const result = await tool.execute("tool-truth-outline", {
      fileName: "outline/story_frame.md",
      content: "# Story Frame\n\nThe harbor debt is the central pressure.\n",
    });

    expect(result.details).toMatchObject({ kind: "proposed_truth_diff" });
    await expect(readFile(join(bookDir, "story", "outline", "story_frame.md"), "utf-8"))
      .resolves.toContain("Old.");

    const proposals = await listTruthProposals(bookDir, "pending");
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.fileName).toBe("outline/story_frame.md");
  });

  it("applies only after confirm and rejects stale base revision", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-g3-apply-"));
    temps.push(root);
    const bookDir = join(root, "books", "harbor");
    await mkdir(join(bookDir, "story"), { recursive: true });
    await writeFile(join(bookDir, "story", "author_intent.md"), "# intent\n\nA\n", "utf-8");

    const proposal = await stageTruthProposal({
      bookDir,
      bookId: "harbor",
      fileName: "author_intent.md",
      currentContent: "# intent\n\nA\n",
      proposedContent: "# intent\n\nB\n",
    });

    await writeFile(join(bookDir, "story", "author_intent.md"), "# intent\n\nexternal edit\n", "utf-8");
    await expect(applyTruthProposal({
      bookDir,
      proposalId: proposal.id,
      currentContent: "# intent\n\nexternal edit\n",
      writeFile: async () => undefined,
    })).rejects.toBeInstanceOf(TruthRevisionConflictError);

    await writeFile(join(bookDir, "story", "author_intent.md"), "# intent\n\nA\n", "utf-8");
    const applied = await applyTruthProposal({
      bookDir,
      proposalId: proposal.id,
      currentContent: "# intent\n\nA\n",
      writeFile: async (fileName, content) => {
        await writeFile(join(bookDir, "story", fileName), content, "utf-8");
      },
    });
    expect(applied.status).toBe("applied");
    await expect(readFile(join(bookDir, "story", "author_intent.md"), "utf-8")).resolves.toContain("B");
    expect(contentRevision("# intent\n\nA\n")).toHaveLength(64);
  });

  it("still writes runtime-truth immediately", async () => {
    const root = await mkdtemp(join(tmpdir(), "fw-g3-rt-"));
    temps.push(root);
    const bookDir = join(root, "books", "harbor");
    await mkdir(join(bookDir, "story"), { recursive: true });
    await writeFile(join(bookDir, "story", "current_state.md"), "# state\n", "utf-8");
    const tool = createWriteTruthFileTool({} as never, root, "harbor");
    const result = await tool.execute("tool-state", {
      fileName: "current_state.md",
      content: "# state\n\nNow at the pier.\n",
    });
    expect(result.details).toBeUndefined();
    await expect(readFile(join(bookDir, "story", "current_state.md"), "utf-8")).resolves.toContain("pier");
  });
});
