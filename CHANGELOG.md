# 更新日志

本文件按 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 记录对用户可见的改动。安装包在 [Releases](https://github.com/qingyou0420/FantaWriter/releases) 下载。本软件中文名「幻想作家」，英文名 FantaWriter。

## [未发布]

## [2.0.7] - 2026-09-03

Windows 补丁安装包：`FantaWriter-Setup-2.0.7.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。

### 修复

- 织卷先定卷，再每批 10 章供审；LLM 流超时不再空转。

## [2.0.6] - 2026-09-03

Windows 补丁安装包：`FantaWriter-Setup-2.0.6.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。

### 修复

- 建书按目标章数/每章字数写出短标题卷章树和提要；大纲侧栏不再把「卷一埋/OKR」散文当卷名；已有书可用织卷按字数重排，不用删书。

## [2.0.5] - 2026-09-02

Windows 补丁安装包：`FantaWriter-Setup-2.0.5.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。

### 修复

- 点创建长篇会开新会话，删除对话后不会再钻回失败的旧建书。

## [2.0.4] - 2026-09-02

Windows 补丁安装包：`FantaWriter-Setup-2.0.4.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。

### 修复

- 修 Moonshot kimi-k3 建书 400：K3 固定温度，自定义服务不再发送 0.7。

## [2.0.3] - 2026-09-02

Windows 补丁安装包：`FantaWriter-Setup-2.0.3.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。

### 修复

- 去掉侧栏左上角坏掉的 LOGO 区域，顶上直接是开始创作。窗口标题、首次设置和安装包图标不动。

## [2.0.2] - 2026-09-02

Windows 补丁安装包：`FantaWriter-Setup-2.0.2.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。2.0.1 还没有应用内「检查更新」按钮，需要先从 Releases 手动装这一版。

### 新增

- 侧栏「系统」和帮助菜单恢复检查更新，可从 GitHub Release 下载安装包并安装重启。

## [2.0.1] - 2026-09-02

Windows 补丁安装包：`FantaWriter-Setup-2.0.1.exe`。许可证仍是 **AGPL-3.0-only**，NOTICE 与 InkOS 署名未改。

### 变更

- 用户可见的 InkOS 标志 / 「InkOS Studio」换成幻想作家 LOGO 与产品名。

### 修复

- 首次配置会写入可列出的自定义服务商（不再丢成认不到的 custom）。

## [2.0.0] - 2026-09-02

第一份正式 **2.0 桌面安装包**：`FantaWriter-Setup-2.0.0.exe`（同时上传 `Fantasy-Writer-Setup-2.0.0.exe` 别名，给仍认旧文件名的 1.7 端）。这是 InkOS 内核 + Electron 壳的首发，不是「P2 已经打磨完毕」的声明。

### 新增

- **InkOS 内核**：稿件落在你选的项目根（默认 `%USERPROFILE%\Documents\幻想作家\`），标准目录 `inkos.json`、`books/`、`.inkos/secrets.json`。密钥只写在本机项目里，**不进 git、不进安装包**。
- **Electron 壳**：单实例、钉端口（从 17831 扫，不用 4567）、首启向导、退出杀引擎、从本仓 GitHub Release 检查更新。
- **连载驾驶舱**：打开书先看今天写哪章、卷进度、到期/逾期伏笔和审稿待办，而不是 1.x Next 的「写下一章」向导。
- **防跑偏闸**：写前必须有大纲条目（可显式带病续写）；正典（方向/骨架/规则）改动先 diff 再确认；审稿问题进队列，critical 默认挡通过；伏笔可标目标章，逾期升为 hook-debt。
- **锁可强制释放**：进程内租约可回收；界面可强释书锁并中止占用任务，避免卡死只能重启。

### 变更

- 产品入口是 Electron + fork 的 InkOS Studio，**不再是** 1.7.x Next.js / IndexedDB 向导。
- 仓库与安装包许可证为 **AGPL-3.0-only**（1.x 已发布的 MIT 安装包不受影响）。
- `pnpm dist:win` 产出 NSIS；GitHub Actions 在 tag `v2.0.0` 上构建并上传安装包与 sha256。

## [2.0.0-dev.1] - 2026-09-01

P1 硬闸（仍是开发快照，不是正式 2.0.0）。

### 新增

- G1 写前闸：目标章无 `volume_map` 条目、骨架/意图为空、或上一章未通过时拒绝写下一章/草稿；可显式「带病续写」。
- G2 有界 packet 落盘为 `story/runtime/chapter-NNNN.packet.json`。
- G3 正典 diff 人闸：chat/agent 改方向/骨架/规则只暂存提案，确认按钮 + 基线修订校验后才写。
- G5 审稿问题队列；critical>0 默认挡通过，覆盖须记入章 meta。
- 伏笔 `targetChapter`：到期/过期进写 packet，过期记 hook-debt critical。
- G6 合并 OpenWrite Apache-2.0 文风禁表到默认 craft；写后违规强制改稿，仍失败则 audit-failed。
- 织卷 / 落墨入口标签（仍走现有 Chat + pipeline）。

### 尚未交付（P2 / 后续）

- 连载驾驶舱完整重写。
- 1.x IndexedDB 备份迁移器。
- 正式 Windows NSIS 安装包装配（见 [2.0.0]）。

## [2.0.0-dev] - 2026-09-01

这是 **2.0 重建的开发快照**，不是正式 2.0.0。没有 `FantaWriter-Setup-2.0.0.exe`。

### 变更

- 产品入口换成 Electron + fork 的 InkOS Studio（v1.8.0）。旧 Next.js 1.7.1 Studio / IndexedDB 不再能从 `pnpm start` 启动。
- 默认项目根：`文档/幻想作家`（Windows 上即 `%USERPROFILE%\Documents\幻想作家\`）。
- 仓库许可证改为 AGPL-3.0-only。
- 书锁可强制释放；进程内过期租约可回收；truth 文件保存会取书锁。
- 引擎端口从 17831 扫描钉住，不再默认 4567。
- 壳接管已有引擎后仍跟踪 pid/port/token，退出与「重启引擎」会 abort+杀进程。
- Dashboard/BookDetail「写下一章」注册可中止任务并占用书锁；BOOK_BUSY 带持有者；强释后管线不再继续落盘。
- BookDetail「草稿」`POST /draft` 同样注册可中止任务并占用书锁，避免强释后幽灵落盘。

### 尚未交付（P1/P2）

- P1 硬闸见 [2.0.0-dev.1]；连载驾驶舱完整重写仍待 P2。
- 1.x 备份迁移器。
- 正式 Windows 安装包装配（见 [2.0.0]）。

## [1.7.1] - 2026-08-29

安装包：`FantaWriter-Setup-1.7.1.exe`（同时上传 `Fantasy-Writer-Setup-1.7.1.exe` 别名）。

### 变更

- 大纲页收成一棵树，摘要就地改。
- 「写这一章」对准被点的章。
- 默认幕节先藏起来。

### 修复

- 过卷向导可关。
- 优化大纲后摘要会跟上。

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

[2.0.7]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.7
[2.0.6]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.6
[2.0.5]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.5
[2.0.4]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.4
[2.0.3]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.3
[2.0.2]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.2
[2.0.1]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.1
[2.0.0]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.0
[2.0.0-dev.1]: https://github.com/qingyou0420/FantaWriter/releases/tag/v2.0.0-dev.1
[1.7.1]: https://github.com/qingyou0420/FantaWriter/releases/tag/v1.7.1
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
