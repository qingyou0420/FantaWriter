# Changelog

## 2.0.1

- 修复安装后主进程崩溃：`Cannot find module '../scripts/setup-artifact.cjs'`。更新器正则已打进 `app.asar/electron/`。

## 2.0.0 — Fantasy Writer / 幻想作家

- 对外品牌更名为 Fantasy Writer / 幻想作家。窗口标题、首页、README、EPUB author、快捷方式同步。
- 安装包主文件：`Fantasy-Writer-Setup-2.0.0.exe`。强制双发布字节相同的 `H-NoveList-Setup-2.0.0.exe`，供库存 1.8.1 更新器扫描。
- `artifactName` 写死连字符模板，禁止从带空格的 `productName` 推导。
- 停止双写旧 IndexedDB / localStorage 键；读仍回退一轮。完整备份文件名改为 `fw-backup-YYYY-MM-DD.json`。
- EPUB `bookId` 前缀 `fw-`。

## 1.11.0 — 卷 / 世界观 / Prompt 工坊 lite（合入 2.0）

- 分卷 UI：创建、重排、删除（至少保留一卷）；全书队列可「仅生成本卷」（`volumeId`，不复用 `job.mode`）。
- 导出 Markdown / TXT / EPUB 与工具页目录预览按卷分节。
- 世界观设定 `LoreEntry`：关键词命中当前章后注入记忆包，上限 8 条 / 合计 2000 字。
- 生成参数增加「附加系统规则」文本框，写入 assemble system 末尾；清空恢复内置 pack。内置提示词只读预览。
- 人物可选别名、说话风格。

## 1.10.x — 双写作台（合入 2.0）

- `schemaVersion=2`，`writingBoard: "general" | "erotic"`。旧项目迁移为 erotic + 默认卷。
- 常规 / 色情提示词、策略、标签库、文风库隔离；泄漏测试作为发版门禁。
- AgeGate：每用户配置确认一次。看板切换不修改 `project.writingBoard`。
- 转换向导默认另存；改台只走 `convertProjectWritingBoard(..., { unlockToken })`。

## 1.8.1

- 基线：色情向 local-first AI 长篇编辑器（人物 / 大纲 / 流式正文 / 全书队列 / 记忆包 / 导出）。
