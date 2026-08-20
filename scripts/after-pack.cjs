/**
 * electron-builder afterPack：
 * 默认 file patterns 会丢掉 extraResources 里的 node_modules，
 * 导致内嵌 Next server 无法 require('next')。
 */
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const projectDir = context.packager.projectDir;
  const resourcesDir =
    context.electronPlatformName === "darwin"
      ? path.join(appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");

  const srcStandalone = path.join(projectDir, ".next", "standalone");
  const destStandalone = path.join(resourcesDir, "standalone");

  if (!fs.existsSync(path.join(srcStandalone, "server.js"))) {
    throw new Error(`afterPack: 缺少 ${srcStandalone}/server.js，请先 npm run build && npm run prepare:standalone`);
  }

  console.log("[afterPack] 同步完整 standalone（含 node_modules）→", destStandalone);
  rm(destStandalone);
  copyDir(srcStandalone, destStandalone);

  // 再清密钥
  for (const name of [".env", ".env.local", ".env.development", ".env.production"]) {
    const p = path.join(destStandalone, name);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }

  const nextPkg = path.join(destStandalone, "node_modules", "next", "package.json");
  if (!fs.existsSync(nextPkg)) {
    throw new Error("[afterPack] standalone/node_modules/next 仍不存在，打包中止");
  }
  console.log("[afterPack] 校验通过: next 模块已就位");
};
