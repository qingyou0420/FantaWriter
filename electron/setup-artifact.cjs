/**
 * 安装包文件名合同：品牌前缀非捕获，group 1 永远是 semver。
 * 必须放在 electron/ 内，以便打进 app.asar（builder files 只有 electron/**）。
 */
const SETUP_RE =
  /^(?:H-NoveList|Fantasy-Writer)-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.exe$/i;

function versionFromSetupName(name) {
  const m = String(name).match(SETUP_RE);
  return m ? m[1] : null;
}

/** 同一二进制的另一品牌文件名；无法解析则返回 null。 */
function siblingSetupName(name) {
  const version = versionFromSetupName(name);
  if (!version) return null;
  if (/^Fantasy-Writer-Setup-/i.test(String(name))) {
    return `H-NoveList-Setup-${version}.exe`;
  }
  if (/^H-NoveList-Setup-/i.test(String(name))) {
    return `Fantasy-Writer-Setup-${version}.exe`;
  }
  return null;
}

module.exports = { SETUP_RE, versionFromSetupName, siblingSetupName };
