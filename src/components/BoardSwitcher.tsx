"use client";

import type { WritingBoard } from "@/lib/types";

export function BoardSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: WritingBoard;
  onChange: (board: WritingBoard) => void;
  disabled?: boolean;
}) {
  return (
    <div className="board-switch" role="tablist" aria-label="写作台">
      {(["general", "erotic"] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={`board-switch-btn ${value === id ? "active" : ""}`}
          disabled={disabled}
          onClick={() => {
            if (id !== value) onChange(id);
          }}
        >
          {id === "general" ? "常规" : "色情"}
        </button>
      ))}
    </div>
  );
}
