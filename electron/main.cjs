/**
 * Electron 主进程：启动内嵌 Next.js 服务并打开窗口；一键更新检测
 */
const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");
const crypto = require("crypto");
const { spawn, execFile } = require("child_process");

/** 公开常规版独立数据目录。 */
app.setName("fantawriter");
app.setPath("userData", path.join(app.getPath("appData"), "fantawriter"));
if (process.platform === "win32") {
  app.setAppUserModelId("com.fantawriter.app");
}

const DEFAULT_PORT = Number(process.env.ENS_PORT || 17831);
const HOST = "127.0.0.1";
const LOG_MAX_BYTES = 512 * 1024;
const { versionFromSetupName, setupFileNameForVersion } = require("./setup-artifact.cjs");
const {
  DEFAULT_GITHUB_REPO,
  githubLatestApiUrl,
  githubApiHeaders,
  githubAssetHeaders,
  isGithubApiHost,
  isAllowedDownloadUrl,
  parseGithubLatestRelease,
  setupFileNameFromUrl,
  githubCheckErrorMessage,
} = require("./github-release.cjs");
const {
  collectUpdateSearchDirs,
  parseCheckUpdateRequest,
  shouldUseRemoteUpdateCheck,
} = require("./update-search.cjs");

const GITHUB_UPDATE_TOKEN_KEY = "GITHUB_UPDATE_TOKEN";

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let quitting = false;
/** @type {string[]} */
const serverLog = [];

function isDev() {
  return !app.isPackaged;
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.env");
}

function getLogPath() {
  return path.join(app.getPath("userData"), "server.log");
}

function appendLog(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  serverLog.push(text);
  if (serverLog.length > 500) serverLog.shift();
  try {
    fs.appendFileSync(getLogPath(), text + "\n", "utf8");
  } catch {
    /* ignore */
  }
  console.log(line);
}

function applyConfigFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (e) {
    appendLog("读取配置失败: " + e);
  }
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, HOST);
  });
}

function readPinnedAppPort() {
  applyConfigFile(getConfigPath());
  const raw = (process.env.APP_DATA_PORT || "").trim();
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null;
}

function writePinnedAppPort(port) {
  const filePath = getConfigPath();
  const map = readConfigMap(filePath);
  map.set("APP_DATA_PORT", String(port));
  writeConfigMap(filePath, map);
  process.env.APP_DATA_PORT = String(port);
}

async function waitUntilPortFree(port) {
  while (!(await canBindPort(port))) {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["重试", "退出"],
      defaultId: 0,
      cancelId: 1,
      title: "端口被占用",
      message: `端口 ${port} 被其它程序占用，你的本地数据绑定在该端口上。请关闭占用程序后点重试`,
      noLink: true,
    });
    if (response !== 0) {
      throw new Error(`端口 ${port} 被占用，用户选择退出`);
    }
  }
  return port;
}

async function pickListenPort(start) {
  const pinned = readPinnedAppPort();
  if (pinned) {
    appendLog(`使用已固定端口 APP_DATA_PORT=${pinned}`);
    return waitUntilPortFree(pinned);
  }
  let port = start;
  for (let i = 0; i < 40; i++) {
    if (await canBindPort(port)) {
      writePinnedAppPort(port);
      appendLog(`首次选定端口 ${port}，已写入 config.env APP_DATA_PORT`);
      return port;
    }
    appendLog(`端口 ${port} 已被占用，尝试 ${port + 1}`);
    port += 1;
  }
  throw new Error(`端口 ${start}–${port} 均被占用，无法启动`);
}

function isOwnHealth(body) {
  try {
    const data = JSON.parse(body);
    return data && data.ok === true;
  } catch {
    return false;
  }
}

function waitForServer(baseUrl, timeoutMs = 90000) {
  const start = Date.now();
  const healthUrl = `${baseUrl.replace(/\/$/, "")}/api/generate`;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      if (serverProcess && serverProcess.exitCode !== null) {
        reject(
          new Error(
            diagnoseServerExit(serverProcess.exitCode)
          )
        );
        return;
      }
      const req = http.get(healthUrl, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (isOwnHealth(body)) {
            resolve(true);
            return;
          }
          retry(`健康检查未通过（HTTP ${res.statusCode}）`);
        });
      });
      req.on("error", () => retry("连接未就绪"));
      req.setTimeout(1500, () => {
        req.destroy();
        retry("健康检查超时");
      });
    };
    const retry = (why) => {
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `等待本地服务超时：${healthUrl}\n${why}\n日志：${getLogPath()}\n最近输出：\n${serverLog.slice(-20).join("\n")}`
          )
        );
        return;
      }
      setTimeout(tryOnce, 400);
    };
    tryOnce();
  });
}

function rotateLogIfNeeded() {
  try {
    const p = getLogPath();
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.size <= LOG_MAX_BYTES) return;
    const raw = fs.readFileSync(p, "utf8");
    const keep = raw.slice(-Math.floor(LOG_MAX_BYTES / 2));
    fs.writeFileSync(p, `--- 日志已截断，保留上次启动尾部 ---\n${keep}`, "utf8");
  } catch {
    /* ignore */
  }
}

function diagnoseServerExit(code) {
  const tail = serverLog.slice(-40).join("\n");
  const standaloneDir = getStandaloneDir();
  const serverJs = path.join(standaloneDir, "server.js");
  if (!fs.existsSync(serverJs)) {
    return `找不到内嵌服务入口 server.js。\n安装包可能不完整，请重新安装。\n日志：${getLogPath()}`;
  }
  if (/EADDRINUSE|address already in use|端口/.test(tail)) {
    return `端口被占用，无法启动内嵌服务。\n请关闭占用程序后重试。\n日志：${getLogPath()}`;
  }
  if (/config\.env|ENOENT.*config|解析配置|读取配置失败/.test(tail)) {
    return `配置文件无法解析。\n请检查用户目录下的 config.env 是否写坏。\n日志：${getLogPath()}`;
  }
  return `内嵌服务已退出（代码 ${code ?? "未知"}）。\n请查看日志：${getLogPath()}\n\n最近日志：\n${tail}`;
}

function getStandaloneDir() {
  return path.join(process.resourcesPath, "standalone");
}

function startProductionServer(listenPort) {
  const standaloneDir = getStandaloneDir();
  const serverJs = path.join(standaloneDir, "server.js");
  const nextModule = path.join(standaloneDir, "node_modules", "next");

  appendLog(`standaloneDir=${standaloneDir}`);
  appendLog(`server.js exists=${fs.existsSync(serverJs)}`);
  appendLog(`next module exists=${fs.existsSync(nextModule)}`);

  if (!fs.existsSync(serverJs)) {
    throw new Error(`找不到服务入口：${serverJs}`);
  }
  if (!fs.existsSync(nextModule)) {
    throw new Error(
      `缺少 next 模块：${nextModule}\n安装包可能不完整，请重新执行 npm run dist:win 打包。`
    );
  }

  rotateLogIfNeeded();

  applyConfigFile(getConfigPath());
  applyConfigFile(path.join(path.dirname(app.getPath("exe")), "config.env"));

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(listenPort),
    HOSTNAME: HOST,
    APP_CONFIG_PATH: getConfigPath(),
  };

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (d) => {
    appendLog(`[stdout] ${d.toString().trim()}`);
  });
  serverProcess.stderr?.on("data", (d) => {
    appendLog(`[stderr] ${d.toString().trim()}`);
  });
  serverProcess.on("exit", (code, signal) => {
    appendLog(`Next server exited code=${code} signal=${signal}`);
    serverProcess = null;
    if (!quitting && code && code !== 0) {
      dialog.showErrorBox("内嵌服务已退出", diagnoseServerExit(code));
    }
  });

  return `http://${HOST}:${listenPort}`;
}

async function resolveAppUrl() {
  if (isDev()) {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
    process.env.APP_CONFIG_PATH = getConfigPath();
    applyConfigFile(getConfigPath());
    await waitForServer(devUrl, 120000);
    return devUrl;
  }
  const listenPort = await pickListenPort(DEFAULT_PORT);
  const url = startProductionServer(listenPort);
  await waitForServer(url, 90000);
  return url;
}

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: "FantaWriter",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(appUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      if (process.platform === "win32" && serverProcess.pid) {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {
          windowsHide: true,
        });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
}

/* ───────── 版本 / 更新 ───────── */

function parseSemver(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersions(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}



function getPrimaryUpdateDir() {
  if (process.env.UPDATE_DIR && process.env.UPDATE_DIR.trim()) {
    return process.env.UPDATE_DIR.trim();
  }
  return path.join(path.dirname(app.getPath("exe")), "updates");
}

function tryAppPath(name) {
  try {
    return app.getPath(name);
  } catch {
    return "";
  }
}

/** @param {"silent" | "manual"} kind */
function getUpdateSearchDirs(kind) {
  const desktop = tryAppPath("desktop");
  return collectUpdateSearchDirs(kind, {
    env: process.env.UPDATE_DIR?.trim() || "",
    exeUpdates: path.join(path.dirname(app.getPath("exe")), "updates"),
    userDataUpdates: path.join(app.getPath("userData"), "updates"),
    desktopUpdatesFolder: desktop
      ? [
          path.join(desktop, "FantaWriter-Updates"),
          path.join(desktop, "Fantasy-Writer-Updates"),
        ]
      : [],
    desktop,
    downloads: tryAppPath("downloads"),
    documents: tryAppPath("documents"),
    exeDir: path.dirname(app.getPath("exe")),
    devDist: !app.isPackaged ? path.join(process.cwd(), "dist-installer") : "",
  });
}

async function scanInstallersInDir(dir) {
  /** @type {{ path: string, version: string, mtime: number }[]} */
  const found = [];
  if (!dir) return found;
  let st;
  try {
    st = await fs.promises.stat(dir);
  } catch {
    return found;
  }
  if (!st.isDirectory()) return found;
  let names;
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return found;
  }
  for (const name of names) {
    const ver = versionFromSetupName(name);
    if (!ver) continue;
    const full = path.join(dir, name);
    try {
      const s = await fs.promises.stat(full);
      if (!s.isFile()) continue;
      found.push({ path: full, version: ver, mtime: s.mtimeMs });
    } catch {
      /* ignore */
    }
  }
  return found;
}

/** @param {"silent" | "manual"} [kind] */
async function findLatestInstaller(currentVersion, kind = "manual") {
  const searched = getUpdateSearchDirs(kind);
  /** @type {{ path: string, version: string, mtime: number, source: string }[]} */
  const all = [];
  for (const dir of searched) {
    for (const item of await scanInstallersInDir(dir)) {
      all.push({ ...item, source: dir });
    }
  }
  // 仅保留比当前新的；若没有则仍返回目录内最新供提示
  const newer = all.filter((x) => compareVersions(x.version, currentVersion) > 0);
  const pool = newer.length ? newer : all;
  pool.sort((a, b) => {
    const c = compareVersions(b.version, a.version);
    if (c !== 0) return c;
    return b.mtime - a.mtime;
  });
  return { candidates: pool, searchedDirs: searched, allCount: all.length };
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function getBackupsDir() {
  return path.join(app.getPath("userData"), "backups");
}

async function rotateDesktopBackupFiles(dir, keep = 7) {
  if (!dir) return [];
  let names;
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return [];
  }
  const backups = names.filter((n) => /^fw-auto-.+\.json$/i.test(n)).sort();
  const remove = backups.length > keep ? backups.slice(0, backups.length - keep) : [];
  for (const name of remove) {
    try {
      await fs.promises.unlink(path.join(dir, name));
    } catch {
      /* ignore */
    }
  }
  return backups.filter((n) => !remove.includes(n));
}

function isAllowedOpenPath(target) {
  const resolved = path.resolve(String(target || ""));
  const roots = [
    app.getPath("userData"),
    getBackupsDir(),
    getPrimaryUpdateDir(),
    path.join(app.getPath("temp"), "FantaWriter-Updates"),
    path.join(app.getPath("temp"), "Fantasy-Writer-Updates"),
    path.join(app.getPath("userData"), "updates"),
  ];
  return roots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
}

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

/** 把相对路径钉在 root 内；拒绝绝对路径与 `..` */
function resolveRelativeUnderRoot(rootAbs, rel) {
  const normalized = String(rel || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    return { ok: false, message: "相对路径非法" };
  }
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((p) => p === ".." || p === ".")) {
    return { ok: false, message: "相对路径含越界片段" };
  }
  const rootPrefix = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
  const target = path.resolve(rootAbs, ...parts);
  if (target !== rootAbs && !target.startsWith(rootPrefix)) {
    return { ok: false, message: "拒绝访问根目录之外" };
  }
  return { ok: true, target, relativePath: parts.join("/") };
}

function readConfigMap(filePath) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!filePath || !fs.existsSync(filePath)) return map;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
    }
  } catch {
    /* ignore */
  }
  return map;
}

function writeConfigMap(filePath, map) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const lines = [
    "# FantaWriter · 本机配置（由应用写入，请勿分享）",
    ...[...map.entries()].map(([k, v]) => `${k}=${v}`),
    "",
  ];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  if (process.platform === "win32") {
    const user = process.env.USERNAME || process.env.USER || "";
    if (user) {
      execFile(
        "icacls",
        [filePath, "/inheritance:r", "/grant:r", `${user}:F`],
        { windowsHide: true },
        () => {}
      );
    }
  }
}

function getGithubUpdateToken() {
  applyConfigFile(getConfigPath());
  return (
    process.env.GITHUB_UPDATE_TOKEN ||
    process.env.UPDATE_GITHUB_TOKEN ||
    ""
  ).trim();
}

function setGithubUpdateToken(token) {
  const filePath = getConfigPath();
  const map = readConfigMap(filePath);
  const t = String(token || "").trim();
  if (t) {
    map.set(GITHUB_UPDATE_TOKEN_KEY, t);
    process.env.GITHUB_UPDATE_TOKEN = t;
  } else {
    map.delete(GITHUB_UPDATE_TOKEN_KEY);
    delete process.env.GITHUB_UPDATE_TOKEN;
  }
  writeConfigMap(filePath, map);
}

function getGithubUpdateRepo() {
  applyConfigFile(getConfigPath());
  return (process.env.UPDATE_GITHUB_REPO || DEFAULT_GITHUB_REPO).trim();
}

function isAllowedFeedDownloadUrl(url) {
  if (isAllowedDownloadUrl(url)) return true;
  const feed = process.env.UPDATE_FEED_URL?.trim();
  if (!feed) return false;
  try {
    const feedHost = new URL(feed).hostname.toLowerCase();
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && u.hostname.toLowerCase() === feedHost;
  } catch {
    return false;
  }
}

function registerIpc() {
  ipcMain.handle("app:getInfo", () => {
    applyConfigFile(getConfigPath());
    return {
      version: app.getVersion(),
      isDesktop: true,
      isPackaged: app.isPackaged,
      platform: process.platform,
      updateDir: getPrimaryUpdateDir(),
      exeDir: path.dirname(app.getPath("exe")),
    };
  });

  ipcMain.handle("app:getUpdateSettings", () => {
    applyConfigFile(getConfigPath());
    const token = getGithubUpdateToken();
    return {
      hasGithubToken: Boolean(token),
      tokenPrefix: token ? token.slice(0, 4) : "",
      repo: getGithubUpdateRepo(),
    };
  });

  ipcMain.handle("app:setGithubUpdateToken", (_e, token) => {
    const t = String(token || "").trim();
    setGithubUpdateToken(t);
    appendLog(
      t
        ? "已保存更新用 GitHub 令牌（本机 config.env）"
        : "已清除更新用 GitHub 令牌"
    );
    return { ok: true, hasGithubToken: Boolean(t) };
  });

  ipcMain.handle("app:checkUpdate", async (_e, payload) => {
    const { kind } = parseCheckUpdateRequest(payload);
    applyConfigFile(getConfigPath());
    const current = app.getVersion();
    const allowRemote = shouldUseRemoteUpdateCheck(kind);

    // 可选远程 feed：UPDATE_FEED_URL → JSON { version, url }
    // 静默启动检查不走网络：GFW / 代理挂起时 Node 的 socket timeout 盖不住连接阶段。
    const feed = allowRemote ? process.env.UPDATE_FEED_URL?.trim() : "";
    if (feed) {
      try {
        const data = await fetchJson(feed);
        const latest = String(data.version || data.latest || "").replace(/^v/i, "");
        const downloadUrl = String(data.url || data.downloadUrl || "");
        if (latest && parseSemver(latest)) {
          const hasUpdate = compareVersions(latest, current) > 0;
          return {
            ok: true,
            current,
            latest,
            hasUpdate,
            downloadUrl: downloadUrl || undefined,
            source: feed,
            message: hasUpdate
              ? `远程源发现新版本 ${latest}（当前 ${current}）`
              : `已是最新（远程 ${latest}）`,
          };
        }
      } catch (e) {
        appendLog("UPDATE_FEED 失败: " + e);
      }
    }

    let githubHint = "";
    if (allowRemote) {
      try {
        const remote = await checkGithubLatest(current);
        return remote;
      } catch (e) {
        appendLog("GitHub latest 失败: " + e);
        githubHint = githubCheckErrorMessage(e);
      }
    }

    const { candidates, searchedDirs, allCount } = await findLatestInstaller(
      current,
      kind
    );
    const hint = githubHint ? `${githubHint}。已回退本地目录。` : "";
    if (!candidates.length) {
      return {
        ok: true,
        current,
        latest: null,
        hasUpdate: false,
        message:
          kind === "silent"
            ? `已是最新（当前 ${current}）`
            : (hint ? hint + " " : "") +
              `未找到安装包。请将 FantaWriter-Setup-x.y.z.exe 放入更新目录后重试。主目录：${getPrimaryUpdateDir()}`,
        searchedDirs,
      };
    }
    const best = candidates[0];
    const hasUpdate = compareVersions(best.version, current) > 0;
    return {
      ok: true,
      current,
      latest: best.version,
      hasUpdate,
      installerPath: best.path,
      source: best.source,
      message: hasUpdate
        ? `${hint}发现新版本 ${best.version}（当前 ${current}），可一键安装`
        : allCount
          ? `${hint}本地最新安装包为 ${best.version}，不高于当前 ${current}`
          : `${hint}未发现可用更新`,
      searchedDirs,
    };
  });

  ipcMain.handle("app:downloadUpdate", async (_e, payload) => {
    applyConfigFile(getConfigPath());
    const opts =
      payload && typeof payload === "object" ? payload : { downloadUrl: payload };
    const token = getGithubUpdateToken();
    const assetApiUrl = String(opts.assetApiUrl || "").trim();
    const downloadUrl = String(opts.downloadUrl || "").trim();
    const preferApi = Boolean(token && assetApiUrl);
    const url = preferApi ? assetApiUrl : downloadUrl;
    if (!url) {
      return { ok: false, message: "没有可下载的安装包地址" };
    }
    if (!isAllowedFeedDownloadUrl(url)) {
      return { ok: false, message: "拒绝从非 GitHub 地址下载安装包" };
    }
    const fileName =
      setupFileNameFromUrl(downloadUrl) ||
      setupFileNameFromUrl(url) ||
      (opts.version && parseSemver(String(opts.version))
        ? setupFileNameForVersion(opts.version)
        : null);
    if (!fileName || !versionFromSetupName(fileName)) {
      return { ok: false, message: "安装包文件名不符合 FantaWriter-Setup-x.y.z.exe" };
    }
    const destDir = path.join(app.getPath("temp"), "FantaWriter-Updates");
    ensureDir(destDir);
    const dest = path.join(destDir, fileName);
    try {
      appendLog(`下载安装包: ${preferApi ? "GitHub asset API" : "browser_download_url"} → ${fileName}`);
      await downloadFile(url, dest, githubAssetHeaders(token));
      if (!fs.existsSync(dest)) {
        return { ok: false, message: "下载完成但文件不存在" };
      }
      let expected = String(opts.sha256 || "").trim().toLowerCase();
      const checksumUrl = String(opts.sha256DownloadUrl || opts.sha256AssetApiUrl || "").trim();
      if (!expected && checksumUrl && isAllowedFeedDownloadUrl(checksumUrl)) {
        try {
          const sidecar = await fetchText(checksumUrl, githubAssetHeaders(token));
          expected = parseSha256Sidecar(sidecar);
        } catch (e) {
          appendLog("读取校验文件失败: " + e);
        }
      }
      if (expected) {
        const actual = sha256File(dest);
        if (actual !== expected) {
          try {
            fs.unlinkSync(dest);
          } catch {
            /* ignore */
          }
          return { ok: false, message: "安装包校验失败（哈希不匹配），已删除文件" };
        }
      }
      return {
        ok: true,
        path: dest,
        version: versionFromSetupName(fileName) || undefined,
        message: `已下载到 ${dest}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog("下载安装包失败: " + msg);
      return { ok: false, message: `下载失败：${msg}` };
    }
  });

  ipcMain.handle("app:installUpdate", async (_e, installerPath) => {
    const target = String(installerPath || "");
    if (!target || !fs.existsSync(target)) {
      return { ok: false, message: "安装包不存在" };
    }
    if (!/\.exe$/i.test(target)) {
      return { ok: false, message: "仅支持 .exe 安装包" };
    }
    try {
      appendLog(`启动安装包: ${target}`);
      // 优先 shell.openPath：更好触发 UAC / 关联启动
      const openErr = await shell.openPath(target);
      if (openErr) {
        // 回退 spawn
        const child = spawn(target, [], {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
          shell: true,
        });
        child.unref();
        appendLog(`openPath 失败(${openErr})，已 spawn 回退`);
      }
      setTimeout(() => {
        quitting = true;
        stopServer();
        app.quit();
      }, 800);
      return { ok: true, message: "正在启动安装程序并退出…" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle("app:pickInstaller", async () => {
    const win = mainWindow || undefined;
    const res = await dialog.showOpenDialog(win, {
      title: "选择 FantaWriter 安装包",
      filters: [{ name: "安装程序", extensions: ["exe"] }],
      properties: ["openFile"],
      defaultPath: getPrimaryUpdateDir(),
    });
    if (res.canceled || !res.filePaths?.[0]) {
      return { ok: false, message: "已取消" };
    }
    const p = res.filePaths[0];
    const version = versionFromSetupName(path.basename(p)) || undefined;
    return { ok: true, path: p, version, message: "已选择" };
  });

  ipcMain.handle("app:openPath", async (_e, target) => {
    const t = String(target || "");
    if (!t) return { ok: false, message: "路径为空" };
    if (!isAllowedOpenPath(t)) {
      return { ok: false, message: "拒绝打开非用户数据/更新目录的路径" };
    }
    const err = await shell.openPath(t);
    if (err) return { ok: false, message: err };
    return { ok: true };
  });

  ipcMain.handle("app:openUpdateDir", async () => {
    const dir = getPrimaryUpdateDir();
    ensureDir(dir);
    const err = await shell.openPath(dir);
    if (err) return { ok: false, path: dir, message: err };
    return { ok: true, path: dir };
  });

  ipcMain.handle("fs:getSuggestedExportRoot", () => {
    if (!app.isPackaged) {
      return { ok: true, path: process.cwd() };
    }
    try {
      return {
        ok: true,
        path: path.join(app.getPath("documents"), "FantaWriter"),
      };
    } catch {
      return { ok: true, path: path.dirname(app.getPath("exe")) };
    }
  });

  ipcMain.handle("fs:pickDirectory", async (_e, opts) => {
    const win = mainWindow || undefined;
    const res = await dialog.showOpenDialog(win, {
      title: (opts && opts.title) || "选择章节 Markdown 写入目录",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: opts && opts.defaultPath ? String(opts.defaultPath) : undefined,
    });
    if (res.canceled || !res.filePaths?.[0]) {
      return { ok: false, canceled: true, message: "已取消" };
    }
    return { ok: true, path: res.filePaths[0], message: "已选择" };
  });

  ipcMain.handle("fs:writeDesktopBackup", async (_e, payload) => {
    const dir = getBackupsDir();
    ensureDir(dir);
    const fileName = String((payload && payload.fileName) || "").trim();
    if (!/^fw-auto-[A-Za-z0-9._-]+\.json$/.test(fileName)) {
      return { ok: false, message: "备份文件名非法" };
    }
    const target = path.join(dir, fileName);
    try {
      await fs.promises.writeFile(
        target,
        String((payload && payload.content) || ""),
        "utf8"
      );
      const kept = await rotateDesktopBackupFiles(dir, 7);
      return { ok: true, path: target, kept, message: `已写入 ${target}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  });

  ipcMain.handle("app:openBackupDir", async () => {
    const dir = getBackupsDir();
    ensureDir(dir);
    const err = await shell.openPath(dir);
    if (err) return { ok: false, path: dir, message: err };
    return { ok: true, path: dir };
  });

  ipcMain.handle("fs:listTextFiles", async (_e, payload) => {
    const root = String((payload && payload.root) || "").trim();
    const relativeDir = String((payload && payload.relativeDir) || "").trim();
    if (!root) return { ok: false, files: [], message: "导出根目录为空" };
    if (!relativeDir) return { ok: false, files: [], message: "相对目录为空" };

    let rootAbs;
    try {
      rootAbs = path.resolve(root);
    } catch {
      return { ok: false, files: [], message: "根目录无效" };
    }
    const resolved = resolveRelativeUnderRoot(rootAbs, relativeDir);
    if (!resolved.ok) return { ok: false, files: [], message: resolved.message };

    try {
      if (!fs.existsSync(resolved.target) || !fs.statSync(resolved.target).isDirectory()) {
        return { ok: true, files: [], message: "目录不存在" };
      }
      const names = await fs.promises.readdir(resolved.target);
      const files = [];
      for (const name of names) {
        if (!name.toLowerCase().endsWith(".md")) continue;
        const child = resolveRelativeUnderRoot(
          rootAbs,
          `${resolved.relativePath}/${name}`
        );
        if (!child.ok) continue;
        let st;
        try {
          st = fs.statSync(child.target);
        } catch {
          continue;
        }
        if (!st.isFile()) continue;
        files.push({
          relativePath: child.relativePath,
          content: fs.readFileSync(child.target, "utf8"),
        });
      }
      return { ok: true, files, message: `已列出 ${files.length} 个文件` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, files: [], message: msg };
    }
  });

  ipcMain.handle("fs:writeTextFiles", async (_e, payload) => {
    const root = String((payload && payload.root) || "").trim();
    const files = Array.isArray(payload && payload.files) ? payload.files : [];
    const removeRel = Array.isArray(payload && payload.removeRelativePaths)
      ? payload.removeRelativePaths
      : [];
    if (!root) return { ok: false, written: [], message: "导出根目录为空" };
    if (!files.length) return { ok: false, written: [], message: "没有要写入的文件" };

    let rootAbs;
    try {
      rootAbs = path.resolve(root);
    } catch {
      return { ok: false, written: [], message: "根目录无效" };
    }
    const written = [];
    const writtenAbs = new Set();
    const removed = [];

    try {
      ensureDir(rootAbs);
      for (const item of files) {
        const resolved = resolveRelativeUnderRoot(
          rootAbs,
          String((item && item.relativePath) || "")
        );
        if (!resolved.ok) {
          return { ok: false, written, message: resolved.message };
        }
        ensureDir(path.dirname(resolved.target));
        fs.writeFileSync(resolved.target, String((item && item.content) || ""), "utf8");
        written.push(resolved.target);
        writtenAbs.add(resolved.target);
      }
      for (const rel of removeRel) {
        const resolved = resolveRelativeUnderRoot(rootAbs, String(rel || ""));
        if (!resolved.ok) continue;
        if (writtenAbs.has(resolved.target)) continue;
        if (!fs.existsSync(resolved.target)) continue;
        try {
          if (!fs.statSync(resolved.target).isFile()) continue;
          fs.unlinkSync(resolved.target);
          removed.push(resolved.relativePath);
        } catch {
          /* ignore a single stale file */
        }
      }
      return {
        ok: true,
        written,
        removed,
        message: `已写入 ${written.length} 个文件`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, written, removed, message: msg };
    }
  });
}

function stripAuthIfLeavingGithub(headers, hostname) {
  /** @type {Record<string, string>} */
  const next = { ...headers };
  if (!isGithubApiHost(hostname)) {
    delete next.Authorization;
    delete next.authorization;
  }
  return next;
}

/**
 * GET，跟随重定向；离开 GitHub 时去掉 Authorization，避免把令牌带到 CDN。
 * @returns {Promise<import('http').IncomingMessage>}
 */
function httpGet(url, options = {}) {
  const headers = options.headers || {};
  const timeout = options.timeout || 20000;
  const maxRedirects = options.maxRedirects ?? 5;
  return new Promise((resolve, reject) => {
    /** @type {import('http').ClientRequest | null} */
    let req = null;
    let settled = false;
    const timer = setTimeout(() => fail(new Error("请求超时")), timeout);
    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        req?.destroy();
      } catch {
        /* ignore */
      }
      reject(err);
    };
    const ok = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    const go = (current, left) => {
      let u;
      try {
        u = new URL(current);
      } catch (e) {
        fail(e);
        return;
      }
      const lib = u.protocol === "https:" ? require("https") : http;
      const reqHeaders = stripAuthIfLeavingGithub(headers, u.hostname);
      req = lib.get(current, { headers: reqHeaders, timeout }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          if (left <= 0) {
            fail(new Error("重定向过多"));
            return;
          }
          go(new URL(res.headers.location, current).toString(), left - 1);
          return;
        }
        if (code >= 400) {
          res.resume();
          fail(new Error(`HTTP ${code}`));
          return;
        }
        ok(res);
      });
      req.on("error", fail);
      req.on("timeout", () => fail(new Error("请求超时")));
    };
    go(String(url), maxRedirects);
  });
}

function fetchText(url, headers) {
  return httpGet(url, { headers: headers || {}, timeout: 15000 }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      })
  );
}

function parseSha256Sidecar(text) {
  const first = String(text || "").trim().split(/\s+/)[0] || "";
  return /^[a-f0-9]{64}$/i.test(first) ? first.toLowerCase() : "";
}

function fetchJson(url, headers) {
  return httpGet(url, { headers: headers || {}, timeout: 15000 }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      })
  );
}

function downloadFile(url, dest, headers) {
  return httpGet(url, { headers: headers || {}, timeout: 60000 }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const tmp = dest + ".part";
        try {
          if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        const ws = fs.createWriteStream(tmp);
        res.pipe(ws);
        ws.on("finish", () => {
          try {
            fs.renameSync(tmp, dest);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        ws.on("error", reject);
        res.on("error", reject);
      })
  );
}

async function checkGithubLatest(current) {
  const repo = getGithubUpdateRepo();
  const token = getGithubUpdateToken();
  const url = githubLatestApiUrl(repo);
  appendLog(
    `检查 GitHub latest: ${repo} token=${token ? "yes" : "no"}`
  );
  const data = await fetchJson(url, githubApiHeaders(token));
  const parsed = parseGithubLatestRelease(data);
  if (!parsed) {
    throw new Error("latest release 没有 FantaWriter-Setup-x.y.z.exe 安装包");
  }
  const hasUpdate = compareVersions(parsed.version, current) > 0;
  return {
    ok: true,
    current,
    latest: parsed.version,
    hasUpdate,
    downloadUrl: parsed.downloadUrl || undefined,
    assetApiUrl: parsed.assetApiUrl || undefined,
    sha256DownloadUrl: parsed.sha256DownloadUrl || undefined,
    sha256AssetApiUrl: parsed.sha256AssetApiUrl || undefined,
    source: `github:${repo}`,
    message: hasUpdate
      ? `GitHub 发现新版本 ${parsed.version}（当前 ${current}）`
      : `已是最新（GitHub ${parsed.version}）`,
  };
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    appendLog(`userData=${app.getPath("userData")}`);
    registerIpc();
    try {
      const url = await resolveAppUrl();
      createWindow(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dialog.showErrorBox("启动失败", msg + `\n\n日志：${getLogPath()}`);
      app.quit();
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    stopServer();
  });

  app.on("window-all-closed", () => {
    quitting = true;
    stopServer();
    app.quit();
  });
}
