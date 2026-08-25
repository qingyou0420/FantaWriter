/**
 * 发版辅助：把主安装包 FantaWriter-Setup-<ver>.exe 与 .sha256
 * 复制为 Fantasy-Writer-Setup-<ver>.exe / .sha256。
 * 1.4.0 客户端只认旧前缀，latest Release 必须同时挂两套文件名。
 */
const fs = require("fs");
const path = require("path");

const CURRENT_SETUP_PREFIX = "FantaWriter-Setup";
const LEGACY_SETUP_PREFIX = "Fantasy-Writer-Setup";

function setupNamesForVersion(version) {
  const v = String(version || "").replace(/^v/i, "");
  if (!v) throw new Error("缺少 version");
  return {
    version: v,
    primary: `${CURRENT_SETUP_PREFIX}-${v}.exe`,
    legacy: `${LEGACY_SETUP_PREFIX}-${v}.exe`,
  };
}

function hashFromSha256Sidecar(text) {
  const hash = String(text || "").trim().split(/\s+/)[0] || "";
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("sha256 文件格式无效");
  }
  return hash.toLowerCase();
}

function writeSha256Sidecar(filePath, hash) {
  fs.writeFileSync(`${filePath}.sha256`, `${hash}  ${filePath}\n`);
}

/**
 * @param {{ distDir: string, version: string }} opts
 * @returns {{ primary: string, legacy: string, sha256: string }}
 */
function aliasLegacySetup(opts) {
  const distDir = path.resolve(opts.distDir);
  const names = setupNamesForVersion(opts.version);
  const primary = path.join(distDir, names.primary);
  const legacy = path.join(distDir, names.legacy);
  if (!fs.existsSync(primary)) {
    throw new Error(`找不到安装包 ${primary}`);
  }
  const shaSrc = `${primary}.sha256`;
  if (!fs.existsSync(shaSrc)) {
    throw new Error(`找不到校验文件 ${shaSrc}`);
  }
  const sha256 = hashFromSha256Sidecar(fs.readFileSync(shaSrc, "utf8"));
  fs.copyFileSync(primary, legacy);
  writeSha256Sidecar(legacy, sha256);
  return { primary, legacy, sha256 };
}

function main() {
  const version = process.argv[2];
  const distDir = path.resolve(process.argv[3] || "dist-installer");
  const result = aliasLegacySetup({ distDir, version });
  console.log(`[alias-legacy-setup] ${result.primary}`);
  console.log(`[alias-legacy-setup] → ${result.legacy}`);
  console.log(`[alias-legacy-setup] sha256 ${result.sha256}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`[alias-legacy-setup] ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

module.exports = {
  CURRENT_SETUP_PREFIX,
  LEGACY_SETUP_PREFIX,
  setupNamesForVersion,
  hashFromSha256Sidecar,
  aliasLegacySetup,
};
