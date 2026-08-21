"use client";

import Link from "next/link";
import { TagSelector } from "@/components/TagEditor";
import { boardCopy } from "@/lib/copy";
import type { WritingBoard } from "@/lib/types";

export function TagsPanel({
  projectTags,
  library,
  writingBoard = "general",
  onProjectTagsChange,
}: {
  projectTags: string[];
  library: string[];
  writingBoard?: WritingBoard;
  onProjectTagsChange: (tags: string[]) => void;
}) {
  const copy = boardCopy(writingBoard);
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card">
        <h2 className="card-title">{copy.tagsTitle}</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0 mb-3 leading-relaxed">
          {copy.tagsHint}
        </p>
        <TagSelector
          library={library}
          selected={projectTags}
          onChange={onProjectTagsChange}
          label="点击选择 / 取消"
          hint={
            projectTags.length
              ? `已选 ${projectTags.length} 个：${projectTags.join("、")}`
              : copy.tagsEmpty
          }
        />
        <p className="text-xs text-[var(--text-muted)] mt-3 mb-0">
          标签库增删与批量导入请回{" "}
          <Link href="/" className="text-[var(--accent-text)]">
            主页 → 标签库
          </Link>
          。文风学习在{" "}
          <Link href="/" className="text-[var(--accent-text)]">
            主页 → 文风学习
          </Link>
          ，再在「生成参数」中选用。
        </p>
        {library.length === 0 ? (
          <p className="text-xs text-[#f0c0a0] mt-2 mb-0">
            标签库为空，请先到主页添加标签。
          </p>
        ) : null}
      </div>
    </div>
  );
}
