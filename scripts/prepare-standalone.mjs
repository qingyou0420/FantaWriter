/**
 * 把 Next standalone 输出整理为 Electron extraResources 所需结构
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`缺少目录: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rm(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
  console.log("已移除:", path.relative(root, p));
}

const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("未找到 .next/standalone/server.js，请先执行 next build");
  process.exit(1);
}

const staticDest = path.join(standalone, ".next", "static");
const publicDest = path.join(standalone, "public");

console.log("复制 .next/static → standalone/.next/static");
rm(staticDest);
copyDir(staticSrc, staticDest);

if (fs.existsSync(publicSrc)) {
  console.log("复制 public → standalone/public");
  rm(publicDest);
  copyDir(publicSrc, publicDest);
}

// 清理误被 NFT 打进 standalone 的开发文件 / 密钥（切勿打进安装包）
const junk = [
  ".env",
  ".env.local",
  ".env.example",
  "src",
  "scripts",
  "electron",
  "public", // 已复制到正确位置；根下 public 可能重复
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "eslint.config.mjs",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "tsconfig.tsbuildinfo",
  "package-lock.json",
  "next-env.d.ts",
  "dist-installer",
  ".git",
  ".grok",
];

// 仅删 standalone 根下这些名字；保留 server.js / node_modules / package.json / .next
for (const name of junk) {
  // public 若在 root 且我们已 copy 到 standalone/public，不要删刚复制的
  if (name === "public") continue;
  rm(path.join(standalone, name));
}

// 再保险：扫一遍删除任何 .env*
function walkRemoveEnv(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkRemoveEnv(p);
    } else if (
      entry.name === ".env" ||
      entry.name.startsWith(".env.") ||
      entry.name.endsWith(".pem")
    ) {
      rm(p);
    }
  }
}
walkRemoveEnv(standalone);

console.log("standalone 资源准备完成:", standalone);
