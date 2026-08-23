# 幻想作家 / FantaWriter

本地 AI 长篇小说编辑器。面向类型 / 文学 / 网文等**常规虚构长篇**。基于 Next.js + Electron。稿件、设定与 API 密钥都留在你自己的电脑上。

A local AI editor for long-form mainstream fiction. Next.js + Electron. Your data stays on your machine.

当前版本：**1.4.0**

## 系统要求

- **安装包**：仅 Windows 64 位（x64）。没有 macOS / Linux 安装包。
- **模型接口**：请自备 **OpenAI 兼容** 的 API（例如 DeepSeek）。在应用里填写 Base URL、API Key 和模型名。本软件不提供账号，也不代管密钥。

## 下载

到 GitHub 最新发行页下载安装包：

**https://github.com/qingyou0420/FantaWriter/releases/latest**

文件名形如 **`Fantasy-Writer-Setup-*.exe`**（例如 `Fantasy-Writer-Setup-1.4.0.exe`）。

## Windows 提示「已保护你的电脑」

当前安装包**没有代码签名**。Windows SmartScreen 可能弹出 **Windows protected your PC / Windows 已保护你的电脑**。这是未签名软件的常见拦截，**不是**已经通过 SmartScreen 认证。

请点 **More info（更多信息）** → **Run anyway（仍要运行）**。以后如果为安装包购买代码签名证书，这类提示会少很多。

## 第一次打开

1. 安装并启动「FantaWriter」。
2. 若首页提示「尚未配置 API Key」，打开右上角 **设置 → API 设置**。
3. 填写三项后点 **保存**：
   - **API Key**：你的密钥
   - **Base URL**：接口地址（界面默认 `https://api.deepseek.com`，可改成你使用的兼容服务）
   - **模型**：模型名（界面默认 `deepseek-v4-pro`，按你账号实际可用的名称填写）
4. 密钥写在本机（桌面端在 `%APPDATA%\fantasy-writer`），不会进这个公开仓库。

生成正文会按你选用的接口计费。全书一键生成前，先确认章节数量。

## 能做什么

- **项目**：多部小说本地保存；可导入 / 导出单个项目。
- **设定**：人物设定、故事背景、世界观（地点 / 组织 / 物品 / 规则）。
- **大纲与分卷**：AI 生成可编辑大纲；作品可按卷分章。
- **正文**：按章流式生成，可润色、续写；支持全书或本卷队列。
- **原作焕新**：粘贴或导入旧稿，先锁定不能改的事实，再**抽取故事骨架**；确认写入后，在章拍工作台**按拍扩写**（先预览，接受后才进正文）。
- **本地备份**：右上角设置可「下载完整备份」「导入完整备份」；项目「工具」页可查看 / 恢复自动备份。桌面端还会在用户目录落盘备份。
- **应用内更新**：桌面端 **设置 → 检查更新**，从本仓 [GitHub Releases](https://github.com/qingyou0420/FantaWriter/releases/latest) 下载并安装。公开仓无需填写更新令牌。

数据优先存在本机 IndexedDB（库名 `fantasy-writer`）。桌面端用户目录是 `%APPDATA%\fantasy-writer`。

## 许可证

[MIT](LICENSE)。Copyright © 2026 FantaWriter / 幻想作家。

## 从源码运行（可选）

需要 Node.js 18 及以上。多数读者直接下 exe 即可，不必走这里。

```bash
git clone https://github.com/qingyou0420/FantaWriter.git
cd FantaWriter
cp .env.example .env.local   # 也可不改文件，启动后在「设置 → API 设置」填写
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。桌面开发：`npm run electron:dev`。在 Windows 上打安装包：`npm run dist:win`。
