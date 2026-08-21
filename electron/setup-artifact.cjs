/**
 * 安装包文件名合同：品牌前缀非捕获，group 1 永远是 semver。
 * 必须放在 electron/ 内，以便打进 app.asar（builder files 只有 electron/**）。
 */
const SETUP_RE =
  /^Fantasy-Writer-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.exe$/i;

function versionFromSetupName(name) {
  const m = String(name).match(SETUP_RE);
  return m ? m[1] : null;
}

module.exports = { SETUP_RE, versionFromSetupName };
