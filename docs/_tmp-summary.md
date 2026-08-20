# Writer Summary — Fantasy Writer 重构规划

- **文档**: `C:\Users\Administrator\AppData\Local\Temp\grok-Administrator\grok-design-doc-378e5b41.md`
- **仓库副本**: `D:\Grisia Studio\H Nove List\docs\Fantasy-Writer-重构规划与开发方案.md`
- **语言**: 全文中文
- **状态**: Draft / 2026-08-17 / 基线 h-novelist 1.8.1
- **未实现应用代码**: 仅规划

## 结论（一句话）

就地演化 Next.js 16 + Electron 37 + IndexedDB，正式更名为 Fantasy Writer / 幻想作家；用 `WritingMode` + Prompt/Policy/Asset 三 pack 做成常规/色情两个一等写作台，不 fork AGPL/GPL，不削弱 18+。

## 已核对的现网锚点

- 存储键 `erotic-novel-studio:*`、IDB `erotic-novel-studio`、主题键 `h-novelist:*`
- 全局 `ADULT_SYSTEM` / `SETTING_SYSTEM`（`src/lib/prompts.ts`）
- `GenerationSettings.eroticLevel`、`DEFAULT_TAG_LIBRARY` 性行为标签
- 桌面 `SETUP_RE` 只认 `H-NoveList-Setup-*.exe`；preload 桥名 `eroticNovelStudio`
- 已有且必须保留：记忆包、全书队列、章版本、导出、一致性工具

## 调研（星标/许可证均来自 GitHub，未编造）

常规：novelWriter 3.1k GPLv3、NovelForge 1.1k AGPL、autonovel 1.5k 无 LICENSE 文件、马良 851 Apache-2.0、Vela 520 GPL、show-me-the-story ~476 MIT 等。

成人/RP：SillyTavern 32.2k AGPL、RisuAI 1.6k GPL、agnai 771 AGPL、Card V2 规格 183、koboldcpp 11.4k AGPL。

## 执行切片

| 里程碑 | 版本 | 要点 |
|--------|------|------|
| M0 | 1.9.0 | schemaVersion=2、mode=erotic 默认、双读双写、更新器双正则 |
| M1 | 1.9.5 | 双看板 + prompt/policy 拆分 + 库分桶 + 泄漏测试 |
| M2 | 1.10.0 | 文学闭环、零色情泄漏 |
| M3 | 1.11.0 | 卷 + Lore + Prompt Workshop lite |
| M4 | 2.0.0 | 对外更名、停双写、安装包 Fantasy-Writer-Setup |

## Key Decisions（摘）

- 不换栈；`appId` 保留 `com.hnovelist.app`；M4 前不改 `package.json.name`（锁 userData）
- 项目 mode 不可被看板改写；旧书全部 erotic
- vitest 泄漏门禁为发版条件
- PR0–PR13 已按可独立审查顺序列出

## 开放问题（需拍板）

文学政策是否硬拦性描写、转换向导默认另存、全新安装默认看板、产品自身开源许可证。
