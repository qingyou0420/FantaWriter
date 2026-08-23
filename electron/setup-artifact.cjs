/**
 * 安装包文件名合同：品牌前缀非捕获，group 1 永远是 semver。
 * 新前缀 FantaWriter-Setup；仍识别已发布的 Fantasy-Writer-Setup（含 1.4.0）。
 * 必须放在 electron/ 内，以便打进 app.asar（builder files 只有 electron/**）。
 */
const CURRENT_SETUP_PREFIX = "FantaWriter-Setup";

const SETUP_RE =
  /^(?:FantaWriter|Fantasy-Writer)-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.exe$/i;

function versionFromSetupName(name) {
  const m = String(name).match(SETUP_RE);
  return m ? m[1] : null;
}

function setupFileNameForVersion(version) {
  const v = String(version || "").replace(/^v/i, "");
  return `${CURRENT_SETUP_PREFIX}-${v}.exe`;
}

/** 同版本时优先新前缀（0 优于 1）。 */
function preferSetupRank(name) {
  return /^FantaWriter-Setup-/i.test(String(name)) ? 0 : 1;
}

module.exports = {
  SETUP_RE,
  CURRENT_SETUP_PREFIX,
  versionFromSetupName,
  setupFileNameForVersion,
  preferSetupRank,
};
