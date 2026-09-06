/**
 * 安装包文件名合同：品牌前缀非捕获，group 1 永远是 semver。
 * 新前缀 Inkborne-Setup；仍识别已发布的 FantaWriter-Setup 与 Fantasy-Writer-Setup。
 * 必须放在 packages/desktop/lib，以便打进 app.asar。
 */
const CURRENT_SETUP_PREFIX = "Inkborne-Setup";

const SETUP_RE =
  /^(?:Inkborne|FantaWriter|Fantasy-Writer)-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.exe$/i;

function versionFromSetupName(name) {
  const m = String(name).match(SETUP_RE);
  return m ? m[1] : null;
}

function setupFileNameForVersion(version) {
  const v = String(version || "").replace(/^v/i, "");
  return `${CURRENT_SETUP_PREFIX}-${v}.exe`;
}

/** 同版本时优先新前缀（0 优于 1 优于 2）。 */
function preferSetupRank(name) {
  const n = String(name);
  if (/^Inkborne-Setup-/i.test(n)) return 0;
  if (/^FantaWriter-Setup-/i.test(n)) return 1;
  return 2;
}

module.exports = {
  SETUP_RE,
  CURRENT_SETUP_PREFIX,
  versionFromSetupName,
  setupFileNameForVersion,
  preferSetupRank,
};
