"use client";

import type { WritingBoard } from "@/lib/types";

export function ModeBadge({ board }: { board: WritingBoard }) {
  return (
    <span className={`mode-badge ${board === "erotic" ? "mode-badge-erotic" : ""}`}>
      {board === "erotic" ? "色情" : "常规"}
    </span>
  );
}
