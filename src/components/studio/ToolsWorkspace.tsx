"use client";

import type { ReactNode } from "react";
import type { ToolsSection } from "@/lib/project-tabs";

const SECTIONS: { id: ToolsSection; label: string }[] = [
  { id: "tools", label: "工具" },
  { id: "settings", label: "生成参数" },
  { id: "tags", label: "标签库" },
  { id: "jobs", label: "批量任务" },
  { id: "migrate", label: "项目迁移" },
  { id: "styles", label: "文风学习" },
];

export function ToolsWorkspace({
  section,
  onSection,
  children,
}: {
  section: ToolsSection;
  onSection: (id: ToolsSection) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap gap-1 px-4 pt-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`tab ${section === s.id ? "active" : ""}`}
            onClick={() => onSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
}
