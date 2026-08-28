"use client";

import { useState } from "react";
import type { LibrarySection } from "@/lib/project-tabs";
import type { ReactNode } from "react";

const SECTIONS: { id: LibrarySection; label: string }[] = [
  { id: "intent", label: "作者意图" },
  { id: "focus", label: "创作罗盘" },
  { id: "foundation", label: "故事基础" },
  { id: "characters", label: "人物" },
  { id: "world", label: "世界设定" },
  { id: "threads", label: "线索 / 伏笔" },
];

export function LibraryWorkspace({
  section,
  onSection,
  children,
}: {
  section: LibrarySection;
  onSection: (id: LibrarySection) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap gap-1 px-4 pt-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`tab ${section === s.id ? "active" : ""}`}
            onClick={() => {
              onSection(s.id);
              setOpen(true);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {open ? children : null}
      </div>
    </div>
  );
}
