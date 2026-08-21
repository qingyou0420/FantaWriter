# Changelog

## Unreleased

## 1.1.0

已安装的 1.0.0 桌面端可从本仓 GitHub Release 检查到此版本。安装包 `Fantasy-Writer-Setup-1.1.0.exe`。

- **P0 篇幅硬约束**：章节篇幅改为数字硬约束，不足自动续写一次并提供「一键补足」。
- **出场人物**：本章可勾选出场人物，其余只注入一行名片，状态卡不再重复静态人设。
- **原作只锁事实**：原作焕新改为忠实事实、文笔跟指南，摘录按名称检索并随章节推进原文区段。
- **文风指纹注入**：学习文风的 fingerprints 写入生成提示词。
- **卷摘要进记忆**：卷 `Volume.summary` 进入记忆包，缺章摘要可一键补。
- **复查后修**：润色带上 `outline`；续写带前情（`previousSummary` / `previousSummaries`）；按卷生成大纲若该卷已有正文先确认；`tsc` 可通过。

## 1.0.0 — 常规独立版

这是公开仓 `qingyou0420/huanxiang-zuojia` 的**第一版常规独立发行**。产品只写正统常规小说（Fantasy Writer / 幻想作家），不再包含双写作台或其它写作台切换。

- 品牌：Fantasy Writer / 幻想作家。安装包 `Fantasy-Writer-Setup-1.0.0.exe`。
- Electron `appId`：`com.fantasywriter.app`。userData 使用 `%APPDATA%\fantasy-writer`，不与其它产品共用项目目录。
- 人物 / 大纲 / 分卷 / 原作焕新 / 写进仓库 / 正文生成全部保留。原作焕新保持通用（按用户锁定的名称与事实遵守原文）。
- 检查更新默认读本仓公开 GitHub Release，无需填写更新令牌。
- 发版 workflow 上传 `Fantasy-Writer-Setup-x.y.z.exe`。

## Unreleased（并入 1.0.0）

- **桌面更新走 GitHub Release**：打 `vX.Y.Z` tag 或手动跑 `release-win` Actions，在 Windows 上打 NSIS 包并上传到该 tag 的 Release。
- **原作焕新**：项目可挂原作底稿并锁定设定（名称 + 一句话）。人物扩写、大纲、正文生成会注入原文摘录与用户锁定条目。
- **写进仓库**：把当前章或全部已完成章写成 `novels/<书名>/ch-<chapterId>.md`。
