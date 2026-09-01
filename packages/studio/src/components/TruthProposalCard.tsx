/**
 * G3 confirm card for pending truth-diff proposals (P1 APIs).
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { postApi } from "../hooks/use-api";
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

  const run = async (action: "apply" | "reject") => {
    setPending(action);
    try {
      await postApi(`/books/${bookId}/truth-proposals/${proposal.id}/${action}`);
      onResolved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2"
      data-testid="truth-proposal-card"
    >
      <div className="text-sm font-medium">
        {isZh ? "正典待确认" : "Canon change pending"} · <code className="text-xs">{proposal.fileName}</code>
      </div>
      {proposal.unifiedDiff && (
        <pre className="max-h-40 overflow-auto rounded-lg bg-background/60 p-2 text-[11px] leading-5 text-muted-foreground whitespace-pre-wrap">
          {proposal.unifiedDiff.split("\n").slice(0, 40).join("\n")}
        </pre>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void run("apply")}
          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-50"
        >
          {pending === "apply" ? "…" : (isZh ? "确认写入" : "Apply")}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void run("reject")}
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-50"
        >
          {pending === "reject" ? "…" : (isZh ? "拒绝" : "Reject")}
        </button>
      </div>
    </div>
  );
}
