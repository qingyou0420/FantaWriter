# 幻想作家 / FantaWriter 2.0-dev

Windows 向的**本机桌面**长篇连载工作台。2.0 是一次**重建**，不是把 1.7.x Next.js Studio 迁过来。

内核与 Studio UI fork 自 [InkOS](https://github.com/Narcooo/inkos) v1.8.x（AGPL-3.0）。Electron 壳负责单实例、钉端口、窗口、首启向导和退出杀引擎。稿件落在你选的项目根目录（默认 `%USERPROFILE%\Documents\幻想作家\`），标准 InkOS 布局：`inkos.json`、`books/`、`.inkos/secrets.json`。

当前版本：**2.0.0-dev**（未完成的 2.0，不是正式 2.0.0）。

**[更新日志](./CHANGELOG.md)** · **[2.0 蓝图](./docs/2.0重构蓝图-InkOS内核桌面重建方案.md)** · **[上游说明](./docs/UPSTREAM.md)**

## 这期 P0 做了什么

- 本仓变成 pnpm monorepo：`packages/core`、`packages/studio`、`packages/cli`（调试）、`packages/desktop`。
- `npm start` / `pnpm start` / `pnpm dev` **只会**走 Electron + InkOS Studio 引擎，不能再启动 1.7.1 Next.js UI。
- 引擎启动必须带显式项目根（`argv[2]` / `INKOS_STUDIO` 的 `INKOS_PROJECT_ROOT`），禁止 `process.cwd()`。
- 引擎端口由壳扫描并钉住，默认从 17831 起，**不用 4567**，避免和手动 `inkos studio` 撞车。
- 书锁：进程内租约可回收、`POST /api/v1/books/:id/lock/force-release`、诚实的 `BOOK_BUSY`；truth 文件 PUT 必须取书锁。
- 退出时先 abort 任务、等短暂 flush，再杀掉引擎子进程。
- 许可证改为 **AGPL-3.0-only**。

## 这期刻意没做（P1 / P2）

- OpenWrite 硬闸（大纲范围确认、正典 diff 人闸、审稿问题队列、钩子逾期）。
- 连载驾驶舱 UI 重写。
- 1.7.1 IndexedDB → InkOS 书目录迁移器（可另开 PR）。
- 完整 electron-builder NSIS 安装包装配（pnpm workspace 打包是蓝图 H3，本 PR 以可工作的 `dev`/`start` 路径为准）。
- 不嵌入 Python / OpenWrite 运行时，不复制 37 维审查器。

## 系统要求

- **目标安装包**：Windows 64 位。本 PR 先保证从源码启动的桌面开发路径。
- **Node.js ≥ 22**（InkOS / `node:sqlite`）。桌面引擎实际跑在 Electron 自带的 Node 上（`ELECTRON_RUN_AS_NODE`）。
- **pnpm ≥ 9**。根 `package.json` 已允许 `electron` / `esbuild` 的 install 脚本；若二进制缺失可再跑 `pnpm rebuild electron`。
- **模型接口**：自备 OpenAI 兼容 API。密钥只写在项目根 `.inkos/secrets.json`。

## 从源码运行

```bash
git clone https://github.com/qingyou0420/FantaWriter.git
cd FantaWriter
pnpm install
pnpm build          # 编译 @actalk/inkos-core + Studio dist/
pnpm test           # CI 会跑的子集
pnpm start          # Electron；首次打开走首启向导
# 或
pnpm dev            # 缺 dist 时先 build，再开 Electron
```

引擎冒烟（无窗口）：

```bash
pnpm engine:smoke
```

调试 CLI（显式根，不要靠 cwd）：

```bash
INKOS_PROJECT_ROOT=/abs/path/to/project pnpm --filter @actalk/inkos exec inkos status
```

`pnpm dist:win` 在 P0 **会失败并说明原因**：安装包装配留作后续。

完整上游 `packages/core` 测试套件依赖 SQLite **FTS5**。本环境探测：系统 Node 22.14 的 `node:sqlite` 可用但无 FTS5；**Electron 37 的 `ELECTRON_RUN_AS_NODE` 有 FTS5**（蓝图 H1）。CI 因此跑锁/桌面/引擎绑定子集；有 FTS5 的 Node 上可再跑 `pnpm test:core:full`。

## 上游

见 [docs/UPSTREAM.md](./docs/UPSTREAM.md)。加 remote：

```bash
git remote add inkos-upstream https://github.com/Narcooo/inkos.git
```

## 许可证

[AGPL-3.0-only](LICENSE)。1.x 已发布的 MIT 安装包不受影响。关于页与 `NOTICE` 保留 InkOS 署名。
