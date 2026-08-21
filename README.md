# Fantasy Writer / 幻想作家

本地优先的 Web / 桌面 **AI 长篇写作**应用。设定人物与世界 → AI 生成大纲 → 你改大纲 → 一键生成正文。

这是公开仓的**常规独立版**：只写正统常规小说（类型 / 文学 / 网文长篇）。

AI 默认使用 **DeepSeek**（OpenAI 兼容接口，可改 Base URL / 模型）。

当前版本：**1.2.0**

## 功能

| 模块 | 说明 |
|------|------|
| 项目 | 多项目、**IndexedDB 主存**、JSON 导入导出、完整备份 |
| **原作焕新** | 粘贴/导入旧稿，锁定身份与事实；人物/大纲/正文生成必须读原文 + 锁定设定 |
| 人物设定 | 复数角色 + AI 扩写/优化；可选别名与说话风格 |
| 故事背景 | 标题、梗概等 + AI 扩写 / 优化 |
| 世界观 | 地点/组织/物品/规则；关键词命中后注入生成提示（最多 8 条 / 2000 字） |
| 分卷 | 作品 → 卷 → 章；按卷生成队列；导出与目录预览按卷分组 |
| 生成参数 | 文风 / 人称 / 篇幅；附加系统规则写入 prompt 末尾 |
| 标签 | 类型 / 题材标签 |
| 文风学习 | 主页学习与维护文风库；项目「生成参数」中选用 |
| 大纲 | AI 生成 JSON 大纲；可编辑/增删/排序章节 |
| 正文 | 流式生成/可取消；润色选中、续写；版本历史；分场景生成；查找替换 |
| **全书队列** | 一键生成可 **暂停 / 续跑 / 跳过 / 重试失败章**；可仅生成本卷 |
| **跨章记忆** | 角色状态卡 + 前情摘要 + 上章结尾 + 未回收伏笔 + 命中设定 |
| 阅读 / 主题 | 字号/字体/行宽；浅色/深色 |
| 工具 | 人物一致性、大纲对照、目录预览、用量统计、导出 MD/TXT/EPUB/DOC |
| **导出到文件夹** | 把本章 / 全部已完成章写成 `novels/<书名>/<章>.md`；桌面端写入所选目录，浏览器下载 md/zip |
| API | 可配置 Base URL + 模型（OpenAI 兼容） |

## 环境要求

- Node.js 18 及以上
- DeepSeek API Key：[platform.deepseek.com](https://platform.deepseek.com/api_keys)

## 快速开始

```bash
cd huanxiang-zuojia   # 或你的项目目录
cp .env.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY=...

npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

桌面安装包：`Fantasy-Writer-Setup-1.2.0.exe`。

## 桌面端更新（GitHub Release）

已安装的 Windows 客户端默认从本仓 **GitHub Releases** 检查更新、下载并安装。本地扫桌面/安装目录仍作为失败打底（`publish-update.mjs` 保留）。

1. 把 `package.json` 的 `version` 改成要发的 `X.Y.Z`，合进 GitHub  
2. 打标签并推送：`git tag vX.Y.Z && git push origin vX.Y.Z`（也可在 Actions 里 `workflow_dispatch`，标签须与 `version` 一致）  
3. `release-win` workflow 在 `windows-latest` 打 NSIS 包，用 `GITHUB_TOKEN` 上传到该 tag 的 Release；主资源为 `Fantasy-Writer-Setup-x.y.z.exe`。CI 无证书时跳过签名，不阻断发版。`.env.local` / 密钥不会打进包  
4. 已装客户端：设置 → **检查更新**。有新版本可 **一键安装**（先下载到临时目录，再走原安装流程）

仓 `qingyou0420/huanxiang-zuojia` 是**公开**的，检查更新不需要填写令牌。令牌仅在你自己覆盖私有源时可选，只写入本机 `%APPDATA%\fantasy-writer\config.env`，**不要**提交到 git，也不要写进 `.env.local`。

## 推荐工作流

1. **新建项目**，从零开写；旧稿用「原作焕新」粘贴原文，不要从零遍构  
2. **原作焕新**（若有旧稿）：锁一条原作里不能被改的事实（名称 + 一句话），生成时必须遵守  
3. **人物设定**：至少主角 + 关键配角；有原作时扩写会读锁定设定  
4. **故事背景 / 世界观**：梗概、场景与关键词设定写清楚  
5. **生成参数**：文风 / 人称 / 建议章节数  
6. 点 **AI 生成大纲**，在大纲页逐章微调；需要时添加分卷  
7. **生成本章**，或 **一键生成全部正文** / **仅生成本卷**  
8. 长书中途可 **暂停**，之后 **续跑**；失败章可 **重试**  
9. 在正文页润色，**导出全书**（Markdown / TXT / EPUB / Word）  
10. 需要在磁盘上改稿时：**导出到文件夹**（正文页「把本章导出到文件夹」，或工具页导出全部已完成章）

## 数据存储

- 项目数据优先写入浏览器 **IndexedDB**（库名 `fantasy-writer`）  
- 桌面端 Electron `appId` 为 `com.fantasywriter.app`，userData 为 `%APPDATA%\fantasy-writer`，与其它同名产品隔离  
- API Key 仅在服务端 `.env.local` 或桌面端用户目录 `config.env`，不会进前端包  

详见 `docs/迁移说明.md`。

## 脚本

`scripts/` 里每个文件都有调用方：

| 文件 | 谁调用 |
|------|--------|
| `prepare-standalone.mjs` | `npm run prepare:standalone` / 发版 workflow |
| `publish-update.mjs` | `npm run publish:update`（本地扫安装包打底） |
| `electron-dev.mjs` | `npm run electron:dev` |
| `after-pack.cjs` | electron-builder `afterPack` |
| `setup-artifact.cjs` | 转发到 `electron/setup-artifact.cjs`，供测试与 `publish-update` |
| `patch-electron-rename.mjs` | **手工**。Windows 杀软锁住 `electron.exe`、electron-builder 解压改名失败（EPERM）时，在本机跑一次：`node scripts/patch-electron-rename.mjs` |

## 技术栈

- Next.js 16 (App Router) + TypeScript + Tailwind CSS + React 19  
- `openai` SDK → `https://api.deepseek.com`，默认模型 `deepseek-v4-pro`  
- Electron 桌面打包（Windows NSIS）

## 注意

- 本版只写常规虚构长篇；生成会产生 API 费用，全书一键生成前请确认章节数  
- 生产部署请自行做好访问控制，勿把 Key 提交到 Git
