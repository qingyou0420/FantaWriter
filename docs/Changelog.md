# Changelog

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
