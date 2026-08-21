# Changelog

## Unreleased

## 1.3.0

按 `docs/1.2后迭代空间.md` 做完 P0–P2（不重做 1.2.0 已落地项）。已安装的 1.2.0 桌面端可从本仓 GitHub Release 检查到此版本。安装包 `Fantasy-Writer-Setup-1.3.0.exe`。

- **P0 数据安全**：桌面端口首次选定后写入 `APP_DATA_PORT`，被占弹中文对话框重试，不再静默 +1 换源；保存失败走 `getLastStorageError`，顶栏红色「保存失败」可导出备份；localStorage 只存项目元数据，配额停更与 IDB 读失败降级快照都会提示；完整备份可导回、自动备份可恢复（恢复前快照），桌面端滚动落盘 `userData/backups/` 最近 7 份。
- **P1 过夜队列**：章摘要先落地再开下一章（超时/失败不阻断，失败可重试）；自动一致性与手动同源（带摘要、不截 12 章），结果写入 `lastConsistencyReport`；崩溃后 running 队列归位为已暂停；中转 90s 无增量看门狗 + 未见 `done` 的截断不算成功；多卷长书他卷一行一卷；IDB 按项目分键，编辑 A 不重写 B。
- **P2 体验**：章节导航/大纲目录多卷分组并显示字数；单章全部替换压版本，全书替换可选同步摘要/大纲；thinking 开启时温度滑杆置灰；卷摘要内联多行编辑；release 跑 lint，篇幅区间单源 `LENGTH_RANGES`，lint 0 warning。

## 1.2.0

综合迭代落地。按 `docs/综合迭代方案.md` 做完 P0–P2（不重做已落地的旧 P0 五项）。已安装的 1.1.0 桌面端可从本仓 GitHub Release 检查到此版本。安装包 `Fantasy-Writer-Setup-1.2.0.exe`。

- **P0 工程护栏**：CI 强制 `tsc --noEmit` + lint + vitest；破坏性操作（重生成大纲 / 覆盖正文 / 强制全量）对齐确认；一致性检查 JSON 模板补上 `character`；单章失败可重试，全书队列遇瞬时 5xx 自动再试一次；错误文案人话在前、诊断可展开；桌面壳端口被占则递增，就绪检查认自家 `/api/generate`，退出弹窗按原因分诊，`server.log` 追加保留。
- **P1 写作体验**：continue/scene 并入 `prompts/general.ts`，删掉 `prompts.ts` 死导出（含成人版遗迹文案）；公开版不再新建 `erotic-novel-studio`；正文温度可调，API 设置页可见 `DEEPSEEK_THINKING`；卷摘要可一键生成；章摘要盘点触及伏笔，伏笔板可一键标已回收；进度/标签 tab 并入工具与生成参数，原作 tab 按需出现；新建书显示开写四步卡，各空态带行动按钮。
- **P2 收尾**：新建项目 JSON 不再写 erotic 字段；流式渲染节流；一致性检查优先用章摘要；`app:openPath` 白名单、安装包 sha256 校验、`config.env` 尽力收紧 ACL；「写进仓库」改为「导出到文件夹」；删除空壳 `UpdatePanel` 与无引用脚本。

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
