export const APP_COPY = {
  label: "常规",
  audience: "类型 / 文学 / 网文长篇",
  emptyProjects: "从一句话梗概开始一部长篇。",
  createConfirm: "确定创建这部小说？",
  tagsTitle: "本书类型标签",
  tagsHint: "从全局类型标签库勾选本书题材/桥段，仅作参考。",
  tagsEmpty: "尚未选择类型标签",
  homeTagsTitle: "类型标签库",
  resetTagsConfirm: "恢复默认类型标签？（不影响各小说已选标签）",
  outlineEmpty: "请先完善人物与背景，再生成可编辑大纲。",
  intensityLabel: "节奏备注",
  footer: "本地小说创作 · 密钥与数据仅存本机",
} as const;

/** @deprecated 本版只有常规小说，保留函数以免旧调用报错 */
export function boardCopy(_board?: string) {
  return APP_COPY;
}
