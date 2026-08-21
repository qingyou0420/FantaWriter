/**
 * GitHub Releases 检查更新：解析 latest、挑 Setup.exe、校验下载地址。
 * 打进 app.asar（builder files 只有 electron/**）。
 */
const { versionFromSetupName } = require("./setup-artifact.cjs");

const DEFAULT_GITHUB_REPO = "qingyou0420/fantasy-writer";
const USER_AGENT = "Fantasy-Writer";

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

function githubLatestApiUrl(repo) {
  const r = String(repo || DEFAULT_GITHUB_REPO).trim();
  return `https://api.github.com/repos/${r}/releases/latest`;
}

function githubApiHeaders(token) {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const t = String(token || "").trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

function githubAssetHeaders(token) {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/octet-stream",
    "User-Agent": USER_AGENT,
  };
  const t = String(token || "").trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

function isGithubApiHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "github.com" || h === "api.github.com";
}

function isAllowedDownloadUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_DOWNLOAD_HOSTS.has(host)) return true;
    return host.endsWith(".githubusercontent.com");
  } catch {
    return false;
  }
}

/**
 * @param {unknown} assets
 * @returns {{ name: string, version: string, downloadUrl: string, assetApiUrl: string } | null}
 */
function pickSetupAsset(assets) {
  if (!Array.isArray(assets)) return null;
  const matched = [];
  for (const raw of assets) {
    if (!raw || typeof raw !== "object") continue;
    const name = String(/** @type {{ name?: string }} */ (raw).name || "");
    const version = versionFromSetupName(name);
    if (!version) continue;
    const downloadUrl = String(
      /** @type {{ browser_download_url?: string }} */ (raw).browser_download_url ||
        ""
    );
    const assetApiUrl = String(/** @type {{ url?: string }} */ (raw).url || "");
    if (!downloadUrl && !assetApiUrl) continue;
    matched.push({
      name,
      version,
      downloadUrl,
      assetApiUrl,
      prefer: /^Fantasy-Writer-Setup-/i.test(name) ? 0 : 1,
    });
  }
  matched.sort((a, b) => a.prefer - b.prefer);
  if (!matched.length) return null;
  const best = matched[0];
  return {
    name: best.name,
    version: best.version,
    downloadUrl: best.downloadUrl,
    assetApiUrl: best.assetApiUrl,
  };
}

/**
 * @param {unknown} json
 * @returns {{
 *   version: string,
 *   downloadUrl: string,
 *   assetApiUrl: string,
 *   assetName: string,
 *   tagName: string,
 * } | null}
 */
function parseGithubLatestRelease(json) {
  if (!json || typeof json !== "object") return null;
  const body = /** @type {{ tag_name?: string, name?: string, assets?: unknown }} */ (
    json
  );
  const asset = pickSetupAsset(body.assets);
  if (!asset) return null;
  return {
    version: asset.version,
    downloadUrl: asset.downloadUrl,
    assetApiUrl: asset.assetApiUrl,
    assetName: asset.name,
    tagName: String(body.tag_name || body.name || ""),
  };
}

function setupFileNameFromUrl(url) {
  try {
    const name = decodeURIComponent(
      String(new URL(String(url)).pathname.split("/").pop() || "")
    );
    return versionFromSetupName(name) ? name : null;
  } catch {
    return null;
  }
}

function githubCheckErrorMessage(err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/HTTP 404/.test(msg)) {
    return "无法读取 GitHub latest release（私有仓请在设置中填写更新用 GitHub 令牌）";
  }
  if (/HTTP 401|HTTP 403/.test(msg)) {
    return "GitHub 令牌无效或权限不足";
  }
  return `GitHub 检查更新失败：${msg}`;
}

module.exports = {
  DEFAULT_GITHUB_REPO,
  USER_AGENT,
  githubLatestApiUrl,
  githubApiHeaders,
  githubAssetHeaders,
  isGithubApiHost,
  isAllowedDownloadUrl,
  pickSetupAsset,
  parseGithubLatestRelease,
  setupFileNameFromUrl,
  githubCheckErrorMessage,
};
