/**
 * Shared G1 fixture seed. Do not weaken write-preflight — tests that exercise
 * write-next / draft need a real volume_map entry, non-empty story_frame, and
 * a non-placeholder author_intent.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_VOLUME_MAP = `## 第 1-200 章 测试卷

测试弧覆盖全部章节，满足落墨预检的卷纲条目。
`;

const DEFAULT_STORY_FRAME = `# 故事框架

这是测试用的非空故事框架，写明主题、基调和终局方向，满足落墨预检。
`;

const DEFAULT_AUTHOR_INTENT = `# 作者意图

测试书的长期创作方向：完成章节、保持人设连贯，并兑现已埋伏笔。
`;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function seedWritePreflightCanon(
  bookDir: string,
  options?: { readonly overwrite?: boolean },
): Promise<void> {
  const storyDir = join(bookDir, "story");
  const outlineDir = join(storyDir, "outline");
  await mkdir(outlineDir, { recursive: true });

  const files: ReadonlyArray<readonly [string, string]> = [
    [join(outlineDir, "volume_map.md"), DEFAULT_VOLUME_MAP],
    [join(outlineDir, "story_frame.md"), DEFAULT_STORY_FRAME],
    [join(storyDir, "author_intent.md"), DEFAULT_AUTHOR_INTENT],
  ];

  for (const [path, content] of files) {
    if (!options?.overwrite && await pathExists(path)) continue;
    await writeFile(path, content, "utf-8");
  }
}
