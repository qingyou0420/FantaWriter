import type { WritingBoard } from "./types";

export const BOARD_COPY = {
  general: {
    label: "常规",
    audience: "类型 / 文学 / 网文长篇",
    emptyProjects: "从一句话梗概开始一部长篇。",
    createConfirm: "这是一部常规小说，确定创建？",
    tagsTitle: "本书类型标签",
    tagsHint:
      "从全局类型标签库勾选本书题材/桥段；仅作参考，不是必须写到的性行为。",
    tagsEmpty: "尚未选择类型标签",
    homeTagsTitle: "类型标签库",
    resetTagsConfirm: "恢复默认类型标签？（不影响各小说已选标签）",
    outlineEmpty: "请先完善人物与背景，再生成可编辑大纲。",
    intensityLabel: "节奏备注",
    footer: "本地小说创作 · 密钥与数据仅存本机",
  },
  erotic: {
    label: "色情",
    audience: "成年向情色虚构 · 18+",
    emptyProjects: "从人物欲望与冲突开始一部成人小说。",
    createConfirm: "这是一部 18+ 色情小说，确定创建？",
    tagsTitle: "本书强制标签",
    tagsHint:
      "从全局标签库勾选本书要用的行为标签；生成大纲与正文时必须体现。单章可在大纲页再叠加。",
    tagsEmpty: "尚未选择本书标签",
    homeTagsTitle: "全局标签库",
    resetTagsConfirm: "恢复默认示例标签库？（不影响各小说已选标签）",
    outlineEmpty: "请先完善人物、背景与本书标签，再生成可编辑大纲。",
    intensityLabel: "情色戏份说明",
    footer: "仅供成年虚构创作 · 密钥与数据仅存本机",
  },
} as const;

export function boardCopy(board: WritingBoard) {
  return BOARD_COPY[board];
}
