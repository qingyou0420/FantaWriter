/**
 * electron-builder afterPack:
 * extraResources drops pnpm symlink node_modules (same 1.7.1 standalone hole).
 * Always re-copy a dereferenced dist-engine into resources/engine.
 */
const fs = require("fs");
const path = require("path");
const { assertNoSecrets } = require("../../../scripts/lib/refuse-secrets.cjs");
const { copyTree } = require("../../../scripts/lib/copy-tree.cjs");

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

  if (!engineOk(srcEngine)) {
    throw new Error(`afterPack: 缺少完整引擎 ${srcEngine}（先跑 node scripts/assemble-engine.mjs）`);
  }

  console.log("[afterPack] 同步完整引擎（解引用 node_modules）→", destEngine);
  rm(destEngine);
  copyTree(srcEngine, destEngine);

  if (!engineOk(destEngine)) {
    throw new Error("[afterPack] resources/engine 仍缺少 studio dist 或 core build");
  }

  assertNoSecrets(destEngine, "resources/engine");
  console.log("[afterPack] 校验通过: studio dist + @actalk/inkos-core + hono 已就位");
};
