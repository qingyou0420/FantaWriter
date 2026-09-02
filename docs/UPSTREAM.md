# InkOS fork / 上游

本仓 2.0 内核与 Studio 工作台 fork 自 [InkOS](https://github.com/Narcooo/inkos) **v1.8.0**。

## Pin

- 远程：`https://github.com/Narcooo/inkos`
- 标签：`v1.8.0`（见 `third_party/INKOS-UPSTREAM-TAG`）
- 提交：`52075bb97422a07315a27094c666dd87e60506b7`（见 `third_party/INKOS-UPSTREAM-COMMIT`）
- 许可证：AGPL-3.0-only（`third_party/INKOS-LICENSE`）

## 布局

| 本仓路径 | 上游 |
|---|---|
| `packages/core` | `packages/core`（`@actalk/inkos-core`） |
| `packages/studio` | `packages/studio`（`@actalk/inkos-studio`） |
| `packages/cli` | `packages/cli`（调试用 `inkos` CLI） |
| `packages/desktop` | 新：幻想作家 Electron 壳 |

文件版权头保持 InkOS 原样。P0 对 fork 的功能性改动（锁 TTL / force-release、显式项目根、拒绝默认 4567、truth PUT 取锁）已在对应文件中实现，并在本仓 CHANGELOG 记录。

## 合流

```bash
git remote add inkos-upstream https://github.com/Narcooo/inkos.git
git fetch inkos-upstream v1.8.0
```

后续按版本节奏择机合流。core 改动保持窄插口；UI 深改留给 P2。

## P0 hunches（2026-09-01 实测）

- **H1**：系统 Node 22.14 的 `node:sqlite` 可 `require`，FTS5 虚拟表不可用（`no such module: fts5`）。记忆检索/管线全套测试会因此失败。同一台机器上 **Electron 37 `ELECTRON_RUN_AS_NODE` 的 `node:sqlite` 有 FTS5**。桌面引擎走 Electron 自带 Node 时记忆检索应可用；CI 的系统 Node 仍跑锁/绑定子集。退路仍是捆一份带 FTS5 的 Node 22，或只换 `memory-db.ts` / `local-search.ts` 驱动。
- **H2**：Studio 生产必须预构建 `packages/studio/dist/`。桌面引擎设 `INKOS_DISABLE_VITE_BUILD=1`，缺 `index.html` 直接退出。
- **H3**：`pnpm deploy @actalk/inkos-studio --prod dist-engine` 打平 workspace 依赖；`packages/desktop/electron-builder.yml` 把该树放进 `extraResources/engine`。壳在 packaged 下从 `process.resourcesPath/engine/dist/api/index.js`（以及 `app.asar.unpacked` 回退）拉引擎。`pnpm dist:win` 在 Windows / `windows-latest` 上产 NSIS。
- **H4**：`@mariozechner/pi-agent-core` / `pi-ai@0.67.1` 可从 npm 装到（包已 deprecated），许可证需后续 `license-checker` 清单。
