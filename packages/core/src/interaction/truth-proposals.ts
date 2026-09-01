/**
 * G3 staged canon diffs. Chat/agent writes to direction/foundation/rules
 * persist under story/runtime/proposals/ until a UI button confirms them.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { classifyTruthAuthority, type TruthAuthority } from "./truth-authority.js";

export const TruthProposalStatusSchema = z.enum(["pending", "applied", "rejected"]);
export type TruthProposalStatus = z.infer<typeof TruthProposalStatusSchema>;

export const TruthProposalSchema = z.object({
  id: z.string().min(1),
  bookId: z.string().min(1),
  fileName: z.string().min(1),
  authority: z.enum(["direction", "foundation", "rules"]),
  baseRevision: z.string().min(1),
  currentContent: z.string(),
  proposedContent: z.string(),
  unifiedDiff: z.string(),
  status: TruthProposalStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  appliedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
});

export type TruthProposal = z.infer<typeof TruthProposalSchema>;

export class TruthRevisionConflictError extends Error {
  readonly code = "TRUTH_REVISION_CONFLICT";
  constructor(
    readonly fileName: string,
    readonly expectedRevision: string,
    readonly actualRevision: string,
  ) {
    super(`Canon file "${fileName}" changed since the proposal was staged. Refresh and restage.`);
    this.name = "TruthRevisionConflictError";
  }
}

export class TruthProposalNotFoundError extends Error {
  readonly code = "TRUTH_PROPOSAL_NOT_FOUND";
  constructor(readonly proposalId: string) {
    super(`Truth proposal "${proposalId}" was not found.`);
    this.name = "TruthProposalNotFoundError";
  }
}

export function requiresCanonDiffGate(fileName: string): boolean {
  const authority = classifyTruthAuthority(fileName);
  return authority === "direction" || authority === "foundation" || authority === "rules";
}

export function contentRevision(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function buildUnifiedDiff(fileName: string, before: string, after: string): string {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const lines = [
    `--- a/story/${fileName}`,
    `+++ b/story/${fileName}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  ];
  const max = Math.max(oldLines.length, newLines.length);
  for (let index = 0; index < max; index += 1) {
    const left = oldLines[index];
    const right = newLines[index];
    if (left === right) {
      lines.push(` ${left ?? ""}`);
      continue;
    }
    if (left !== undefined) lines.push(`-${left}`);
    if (right !== undefined) lines.push(`+${right}`);
  }
  return lines.join("\n");
}

export function proposalsDir(bookDir: string): string {
  return join(bookDir, "story", "runtime", "proposals");
}

function proposalPath(bookDir: string, proposalId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(proposalId)) {
    throw new Error(`Invalid proposal id: ${proposalId}`);
  }
  return join(proposalsDir(bookDir), `${proposalId}.json`);
}

export async function stageTruthProposal(params: {
  readonly bookDir: string;
  readonly bookId: string;
  readonly fileName: string;
  readonly proposedContent: string;
  readonly currentContent: string;
}): Promise<TruthProposal> {
  const authority = classifyTruthAuthority(params.fileName);
  if (authority !== "direction" && authority !== "foundation" && authority !== "rules") {
    throw new Error(`File "${params.fileName}" does not require a canon diff gate.`);
  }
  const now = new Date().toISOString();
  const proposal: TruthProposal = {
    id: randomUUID(),
    bookId: params.bookId,
    fileName: params.fileName,
    authority,
    baseRevision: contentRevision(params.currentContent),
    currentContent: params.currentContent,
    proposedContent: params.proposedContent,
    unifiedDiff: buildUnifiedDiff(params.fileName, params.currentContent, params.proposedContent),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await mkdir(proposalsDir(params.bookDir), { recursive: true });
  await writeFile(proposalPath(params.bookDir, proposal.id), JSON.stringify(proposal, null, 2), "utf-8");
  return proposal;
}

export async function loadTruthProposal(bookDir: string, proposalId: string): Promise<TruthProposal> {
  try {
    const raw = await readFile(proposalPath(bookDir, proposalId), "utf-8");
    return TruthProposalSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new TruthProposalNotFoundError(proposalId);
    }
    throw error;
  }
}

export async function listTruthProposals(
  bookDir: string,
  status: TruthProposalStatus = "pending",
): Promise<ReadonlyArray<TruthProposal>> {
  let names: string[];
  try {
    names = await readdir(proposalsDir(bookDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const loaded = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const raw = await readFile(join(proposalsDir(bookDir), name), "utf-8");
        return TruthProposalSchema.parse(JSON.parse(raw));
      }),
  );
  return loaded
    .filter((proposal) => proposal.status === status)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function applyTruthProposal(params: {
  readonly bookDir: string;
  readonly proposalId: string;
  readonly currentContent: string;
  readonly writeFile: (fileName: string, content: string) => Promise<void>;
}): Promise<TruthProposal> {
  const proposal = await loadTruthProposal(params.bookDir, params.proposalId);
  if (proposal.status === "applied") return proposal;
  const actualRevision = contentRevision(params.currentContent);
  if (actualRevision !== proposal.baseRevision) {
    throw new TruthRevisionConflictError(proposal.fileName, proposal.baseRevision, actualRevision);
  }
  await params.writeFile(proposal.fileName, proposal.proposedContent);
  const now = new Date().toISOString();
  const updated: TruthProposal = {
    ...proposal,
    status: "applied",
    updatedAt: now,
    appliedAt: now,
  };
  await writeFile(proposalPath(params.bookDir, proposal.id), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function rejectTruthProposal(bookDir: string, proposalId: string): Promise<TruthProposal> {
  const proposal = await loadTruthProposal(bookDir, proposalId);
  if (proposal.status !== "pending") return proposal;
  const now = new Date().toISOString();
  const updated: TruthProposal = {
    ...proposal,
    status: "rejected",
    updatedAt: now,
    rejectedAt: now,
  };
  await writeFile(proposalPath(bookDir, proposal.id), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function removeTruthProposal(bookDir: string, proposalId: string): Promise<void> {
  await unlink(proposalPath(bookDir, proposalId)).catch(() => undefined);
}

export type GatedTruthAuthority = Extract<TruthAuthority, "direction" | "foundation" | "rules">;
