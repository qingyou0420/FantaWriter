/**
 * 打包完成后，把最新 Setup 以两个文件名复制到可扫描目录：
 * 1. 桌面/Fantasy-Writer-Updates
 * 2. 桌面/H-NoveList-Updates（库存 1.8.1 客户端）
 * 3. %APPDATA%/h-novelist/updates（Electron userData 默认）
 *
 * 2.0 强制双发布：Fantasy-Writer-Setup-x.y.z.exe 与字节相同的
 * H-NoveList-Setup-x.y.z.exe。
 */
import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { SETUP_RE, siblingSetupName } = require("./setup-artifact.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist-installer");

function parseSemver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmp(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function copyTo(src, destDir) {
  ensureDir(destDir);
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  return dest;
}

function findLatestSetup() {
  if (!fs.existsSync(distDir)) {
    console.error("[publish-update] 无 dist-installer 目录");
    process.exit(1);
  }
  const files = fs
    .readdirSync(distDir)
    .map((name) => {
      const m = name.match(SETUP_RE);
      if (!m) return null;
      const full = path.join(distDir, name);
      try {
        const st = fs.statSync(full);
        if (!st.isFile()) return null;
        return { name, version: m[1], path: full, mtime: st.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (!files.length) {
    console.error("[publish-update] 未找到 H-NoveList-Setup-*.exe 或 Fantasy-Writer-Setup-*.exe");
    process.exit(1);
  }
  files.sort((a, b) => {
    const c = cmp(b.version, a.version);
    return c !== 0 ? c : b.mtime - a.mtime;
  });
  return files[0];
}

const latest = findLatestSetup();
const artifacts = [latest.path];
const sibling = siblingSetupName(latest.name);
if (sibling) {
  const siblingPath = path.join(distDir, sibling);
  try {
    fs.copyFileSync(latest.path, siblingPath);
    artifacts.push(siblingPath);
    console.log(`[publish-update] 双发布副本 ${sibling}`);
  } catch (e) {
    console.warn(`[publish-update] 无法写出双发布副本 ${sibling}: ${e.message || e}`);
  }
}

const desktop = path.join(os.homedir(), "Desktop");
const desktopUpdates = path.join(desktop, "H-NoveList-Updates");
const desktopUpdatesNew = path.join(desktop, "Fantasy-Writer-Updates");
const appDataUpdates = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "h-novelist",
  "updates"
);

const targets = [desktopUpdatesNew, desktopUpdates, appDataUpdates];
console.log(
  `[publish-update] 发布 ${latest.name} (v${latest.version}) 及兼容文件名 → 可被已安装客户端扫描的目录`
);
for (const src of artifacts) {
  for (const dir of targets) {
    try {
      const dest = copyTo(src, dir);
      console.log(`  ✓ ${dest}`);
    } catch (e) {
      console.warn(`  ✗ ${dir}: ${e.message || e}`);
    }
  }
}
console.log(
  "[publish-update] 完成。已装旧版可在应用内「设置 → 检查更新」后一键安装。"
);
