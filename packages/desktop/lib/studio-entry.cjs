/**
 * Locate the prebuilt InkOS Studio engine (packages/studio/dist/api/index.js).
 * Packaged extraResources live under resources/engine (and asar.unpacked fallbacks).
 */
const path = require("path");
const fs = require("fs");

function studioEntryCandidates(opts = {}) {
  const desktopDir = opts.desktopDir || path.resolve(__dirname, "..");
  const workspaceRoot = opts.workspaceRoot || path.resolve(desktopDir, "..", "..");
  const resourcesPath = opts.resourcesPath || "";
  const isPackaged = Boolean(opts.isPackaged);
  /** @type {string[]} */
  const list = [];
  if (isPackaged && resourcesPath) {
    list.push(
      path.join(resourcesPath, "engine", "dist", "api", "index.js"),
      path.join(resourcesPath, "app.asar.unpacked", "engine", "dist", "api", "index.js"),
      path.join(resourcesPath, "packages", "studio", "dist", "api", "index.js"),
      path.join(resourcesPath, "app.asar.unpacked", "packages", "studio", "dist", "api", "index.js"),
    );
  }
  list.push(
    path.join(workspaceRoot, "packages", "studio", "dist", "api", "index.js"),
    path.join(desktopDir, "..", "studio", "dist", "api", "index.js"),
  );
  return list;
}

function resolveStudioEntry(opts = {}) {
  for (const file of studioEntryCandidates(opts)) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/**
 * Engine root is the directory that contains dist/index.html and (when packed)
 * node_modules/@actalk/inkos-core. Used as spawn cwd so ESM walks to those deps.
 */
function resolveEngineRoot(entry) {
  if (!entry) return null;
  let dir = path.dirname(path.resolve(entry));
  for (let i = 0; i < 8; i++) {
    const html = path.join(dir, "dist", "index.html");
    const core = path.join(dir, "node_modules", "@actalk", "inkos-core", "package.json");
    if (fs.existsSync(html) && (fs.existsSync(core) || fs.existsSync(path.join(dir, "node_modules")))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(path.dirname(path.dirname(path.resolve(entry))));
}

module.exports = {
  studioEntryCandidates,
  resolveStudioEntry,
  resolveEngineRoot,
};
