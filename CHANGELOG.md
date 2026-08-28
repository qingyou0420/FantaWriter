# 更新日志

本文件按 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 记录对用户可见的改动。安装包在 [Releases](https://github.com/qingyou0420/FantaWriter/releases) 下载。本软件中文名「幻想作家」，英文名 FantaWriter。

## [未发布]

## [1.7.0] - 2026-08-28

安装包：`FantaWriter-Setup-1.7.0.exe`（同时上传 `Fantasy-Writer-Setup-1.7.0.exe` 别名）。

### 新增

- Studio 工作台：左侧七工作区（总览 / 大纲 / 正文 / 审稿 / 资料库 / AI 协作 / 工具与设置）+ 右侧创作助手。
- 规划「织卷」与写作「落墨」分工；正典 AI 写入须经 diff 确认闸。
- 写下一章管线：写前检查 → 有界 packet → 初稿 → 10 维审稿 → 结算 / 回滚。旧「写下一章」向导已退役。
- 旧项目 schema v2 → v3 无损迁移（章序 / 正文 / 账本保留）。
- 工作台信息架构借鉴 [OpenWrite](https://github.com/LiPu-jpg/Openwrite)（仅思路，未复制代码）。

## [1.6.0] - 2026-08-28

安装包：`FantaWriter-Setup-1.6.0.exe`（同时上传 `Fantasy-Writer-Setup-1.6.0.exe` 别名）。

### 新增

- 有大纲的项目打开后直接进正文。
- 「写下一章」先立本章契约：要写什么、绝不能写什么。续写、改写、按场景生成也会带上契约禁写。
- 定稿要过摘要、账本、伏笔。
- 前提卡与人物真相层：仅作者可见，不进提示词。结局方向默认不给 AI，勾选后才本次参考。
- 新建项目连载默认开。
- 账本条目可置顶。
- 过卷向导：卷摘要、出卷人物快照、伏笔去向、时间线落点。
- 未审章审阅同屏。

### 修复

- 仅作者暗线不再泄漏进生成路径。

## [1.5.1] - 2026-08-27

安装包：`FantaWriter-Setup-1.5.1.exe`（同时上传 `Fantasy-Writer-Setup-1.5.1.exe` 别名）。

### 修复

- 冷启动后窗口一出现，首页项目名等输入框立刻可点可输；静默检查更新不再挡首屏。

## [1.5.0] - 2026-08-27

安装包：`FantaWriter-Setup-1.5.0.exe`（同时上传 `Fantasy-Writer-Setup-1.5.0.exe` 别名）。

### 新增

- 连载模式与滚动排章：可选钩子与连载提示；「续排本卷 N 章」按已有摘要向后接，不改已写章。
- 人物状态账本：章摘要带结构化附录，按人物累积；可手改摘要和账本；工具页可批量补缺失摘要。
- 审阅回路：草稿 / 已审、本章体检、写下一章 / 队列限章；一致性检查可按本卷或自上次以来。
- 存稿 / 发布看板、自定义字数档、中间插章；完卷时可提示生成卷摘要。
- 按章序导出；重排或改题后会清理同章旧文件。
- 正文四项任务可选精写档。

### 变更

- 拍增量确认时可改时间线。

### 修复

- 设置保存不再误清精写档配置。

### 注意

- 原作焕新项目仍不走整书 / 续排。

## [1.4.3] - 2026-08-25

安装包：`FantaWriter-Setup-1.4.3.exe`（同时上传 `Fantasy-Writer-Setup-1.4.3.exe` 别名）。

### 修复

- 启动后，首页项目名等输入框不再因静默检查更新卡住。

## [1.4.2] - 2026-08-25

安装包：`FantaWriter-Setup-1.4.2.exe`（同时上传 `Fantasy-Writer-Setup-1.4.2.exe` 别名）。

### 变更

- 英文名改为 FantaWriter（中文仍为「幻想作家」）。
- 数据目录改为 `%APPDATA%\fantawriter`。

### 注意

- 此版不迁移旧稿；此前数据仍在旧目录。
- 本版起同时上传旧安装包名别名，已安装的 1.4.0 桌面端才能检到 1.4.1 及之后的更新。

## [1.4.1] - 2026-08-25

安装包：`FantaWriter-Setup-1.4.1.exe`。

### 新增

- 从零开写可打开人物编辑框并保存。
- 公开仓补上 MIT 许可证，以及面向下载用户的 README（下载、API、未签名 SmartScreen）。

### 变更

- 安装包改名为 `FantaWriter-Setup-*.exe`。

### 注意

- 检查更新仍识别旧安装包名 `Fantasy-Writer-Setup-*.exe`。

## [1.4.0] - 2026-08-22

安装包：`Fantasy-Writer-Setup-1.4.0.exe`。

### 新增

- 原作焕新：先抽故事骨架，可预览再确认。
- 按节拍扩写：先预览，再接受 / 改稿 / 重生成 / 跳过；接受后才追加正文。
- 伏笔可标「读者已知」或「仅作者」，暗线不泄漏。

### 注意

- 已挂原作的项目不走全书 / 整卷一键生成。

## [1.3.0] - 2026-08-21

安装包：`Fantasy-Writer-Setup-1.3.0.exe`。

### 新增

- 保存失败会明确提示，并可导出备份。
- 自动备份可恢复。
- 多卷目录显示各章字数。

### 变更

- 过夜队列更稳：章摘要先落地；崩溃后正在跑的队列会暂停。
- 全书替换可选同步摘要 / 大纲。
- 一致性检查更完整。

## [1.2.0] - 2026-08-21

安装包：`Fantasy-Writer-Setup-1.2.0.exe`。

### 新增

- 破坏性操作需确认。
- 单章失败可重试。
- 正文温度可调。
- 卷摘要可一键生成。
- 伏笔板可一键标已回收。
- 新建书有开写四步卡。

## [1.1.0] - 2026-08-21

安装包：`Fantasy-Writer-Setup-1.1.0.exe`。

### 新增

- 章节篇幅硬约束；不足可一键补足。
- 本章可勾选出场人物。

### 变更

- 原作焕新只锁定事实。
- 文风指纹会注入提示词。

## [1.0.0] - 2026-08-21

安装包：`Fantasy-Writer-Setup-1.0.0.exe`。

### 新增

- 第一版公开独立发行，只写正规小说。
- 提供 Windows 安装包。
- 从本仓 GitHub Release 检查更新。

[1.7.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.7.0
[1.6.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.6.0
[1.5.1]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.5.1
[1.5.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.5.0
[1.4.3]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.4.3
[1.4.2]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.4.2
[1.4.1]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.4.1
[1.4.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.4.0
[1.3.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.3.0
[1.2.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.2.0
[1.1.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.1.0
[1.0.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.0.0
