/**
 * G3 confirm card for pending truth-diff proposals (P1 APIs).
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { postApi } from "../hooks/use-api";
import { showToast } from "../lib/toast";
import { countUnifiedDiffLines, mapTruthFileLabel } from "../lib/copy-map";
import { useState } from "react";

export interface PendingTruthProposal {
  readonly id: string;
  readonly fileName: string;
  readonly unifiedDiff?: string;
}

export function TruthProposalCard({
  bookId,
  proposal,
  isZh,
  onResolved,
}: {
  readonly bookId: string;
  readonly proposal: PendingTruthProposal;
  readonly isZh: boolean;
  readonly onResolved: () => void;
}) {
  const [pending, setPending] = useState<"apply" | "reject" | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const stats = proposal.unifiedDiff ? countUnifiedDiffLines(proposal.unifiedDiff) : null;
  const label = mapTruthFileLabel(proposal.fileName, isZh);

  const run = async (action: "apply" | "reject") => {
    setPending(action);
    try {
      await postApi(`/books/${bookId}/truth-proposals/${proposal.id}/${action}`);
      onResolved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed", "error");
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-3 space-y-2"
      data-testid="truth-proposal-card"
    >
      <div className="literary-kicker">
        {isZh ? "正典变更" : "Canon change"} · {label}
      </div>
      {proposal.unifiedDiff && stats && (
        <div>
          <button
            type="button"
            data-testid="truth-diff-toggle"
            onClick={() => setDiffOpen((open) => !open)}
            className="btn-ghost h-8 px-2 text-[13px] text-muted-foreground"
          >
            +{stats.added} −{stats.removed} {isZh ? "行" : "lines"} {diffOpen ? "▾" : "▸"} {isZh ? "查看" : "View"}
          </button>
          {diffOpen && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-background/60 p-2 text-[12px] leading-5 text-muted-foreground whitespace-pre-wrap">
              {proposal.unifiedDiff}
            </pre>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void run("apply")}
          className="btn-primary h-8 px-3 text-[13px] disabled:opacity-50"
        >
          {pending === "apply" ? "…" : (isZh ? "写入" : "Apply")}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void run("reject")}
          className="btn-ghost h-8 px-2 text-[13px] disabled:opacity-50"
        >
          {pending === "reject" ? "…" : (isZh ? "拒绝" : "Reject")}
        </button>
      </div>
    </div>
  );
}
