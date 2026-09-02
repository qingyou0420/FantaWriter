/**
 * electron-builder afterPack:
 * default extraResources filters have dropped node_modules before (1.7.1 standalone).
 * Re-copy dist-engine if the packed payload is incomplete, then refuse secrets.
 */
const fs = require("fs");
const path = require("path");
const { assertNoSecrets } = require("../../../scripts/lib/refuse-secrets.cjs");

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

function engineOk(dir) {
  return (
    fs.existsSync(path.join(dir, "dist", "api", "index.js")) &&
    fs.existsSync(path.join(dir, "dist", "index.html")) &&
    fs.existsSync(path.join(dir, "node_modules", "@actalk", "inkos-core", "dist", "index.js")) &&
    fs.existsSync(path.join(dir, "node_modules", "@actalk", "inkos-core", "genres")) &&
    fs.existsSync(path.join(dir, "node_modules", "hono", "package.json"))
  );
}

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const projectDir = context.packager.projectDir;
  const resourcesDir =
    context.electronPlatformName === "darwin"
      ? path.join(appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(appOutDir, "resources");

  const destEngine = path.join(resourcesDir, "engine");
  const srcEngine = path.resolve(projectDir, "..", "..", "dist-engine");

  if (!engineOk(destEngine)) {
    if (!engineOk(srcEngine)) {
      throw new Error(`afterPack: 缺少完整引擎 ${srcEngine}（先跑 node scripts/assemble-engine.mjs）`);
    }
    console.log("[afterPack] extraResources 引擎不完整，同步 dist-engine →", destEngine);
    rm(destEngine);
    copyDir(srcEngine, destEngine);
  }

  if (!engineOk(destEngine)) {
    throw new Error("[afterPack] resources/engine 仍缺少 studio dist 或 core build");
  }

  assertNoSecrets(destEngine, "resources/engine");
  console.log("[afterPack] 校验通过: studio dist + @actalk/inkos-core + hono 已就位");
};
